'use client';

import { OnboardingTargetAudience } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import CollapsibleSection from './CollapsibleSection';
import ChipSelect from './ChipSelect';
import RichTextEditor from './RichTextEditor';
import { Target, Users, HeartHandshake } from 'lucide-react';

interface Step4Props {
  data: OnboardingTargetAudience;
  onChange: (data: OnboardingTargetAudience) => void;
}

const DEFAULT_INTERESTS = [
  'Fashion & Beauty',
  'Fitness & Wellness',
  'Luxury & Lifestyle',
  'Technology & Gadgets',
  'Business & Entrepreneurship',
  'Home & Decor',
  'Food & Dining',
  'Travel & Adventure',
  'Parenting & Family',
  'Personal Growth',
];

const DEFAULT_HOBBIES = [
  'Shopping',
  'Gym & Sports',
  'Social Media Browsing',
  'Reading & Podcasts',
  'Gaming',
  'Cooking',
  'Travel',
  'Photography',
];

export default function Step4TargetAudience({ data = {}, onChange }: Step4Props) {
  const { t } = useLanguage();

  const updateAudienceField = (field: string, val: any) => {
    onChange({
      ...data,
      primary_audience: {
        ...(data.primary_audience || {}),
        [field]: val,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Demographics & Profile */}
      <CollapsibleSection
        title={t('onboarding.s4.demographicsTitle')}
        subtitle={t('onboarding.s4.demographicsSub')}
        icon={Target}
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s4.ageRange')}</Label>
            <Input
              value={data.primary_audience?.age_range || ''}
              onChange={(e) => updateAudienceField('age_range', e.target.value)}
              placeholder="e.g. 22 - 38 years old"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s4.gender')}</Label>
            <Input
              value={data.primary_audience?.gender || ''}
              onChange={(e) => updateAudienceField('gender', e.target.value)}
              placeholder="e.g. Female (70%) / Male (30%)"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s4.location')}</Label>
            <Input
              value={data.primary_audience?.location || ''}
              onChange={(e) => updateAudienceField('location', e.target.value)}
              placeholder="e.g. Cairo, Giza, Alexandria / Gulf Region"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s4.occupation')}</Label>
            <Input
              value={data.primary_audience?.occupation || ''}
              onChange={(e) => updateAudienceField('occupation', e.target.value)}
              placeholder="e.g. Corporate employees, business owners, students"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s4.incomeLevel')}</Label>
            <Input
              value={data.primary_audience?.income_level || ''}
              onChange={(e) => updateAudienceField('income_level', e.target.value)}
              placeholder="e.g. Middle to Upper Class (A/B Class)"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 2. Psychographics (Interests & Hobbies) */}
      <CollapsibleSection
        title={t('onboarding.s4.interestsHobbiesTitle')}
        subtitle={t('onboarding.s4.interestsHobbiesSub')}
        icon={Users}
        defaultOpen={true}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('onboarding.s4.interests')}</Label>
            <ChipSelect
              options={DEFAULT_INTERESTS}
              selected={data.primary_audience?.interests || []}
              onChange={(selected) => updateAudienceField('interests', selected)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('onboarding.s4.hobbies')}</Label>
            <ChipSelect
              options={DEFAULT_HOBBIES}
              selected={data.primary_audience?.hobbies || []}
              onChange={(selected) => updateAudienceField('hobbies', selected)}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 3. Buying Behavior & Objections */}
      <CollapsibleSection
        title={t('onboarding.s4.buyingBehaviorTitle')}
        subtitle={t('onboarding.s4.buyingBehaviorSub')}
        icon={HeartHandshake}
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">{t('onboarding.s4.audiencePainPoints')}</Label>
            <Textarea
              value={data.primary_audience?.pain_points || ''}
              onChange={(e) => updateAudienceField('pain_points', e.target.value)}
              placeholder="What problems does the audience face that this brand solves?"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s4.buyingMotivations')}</Label>
            <Textarea
              value={data.primary_audience?.buying_motivations || ''}
              onChange={(e) => updateAudienceField('buying_motivations', e.target.value)}
              placeholder="What triggers them to purchase? (Status, convenience, price, luxury)"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s4.buyingObjections')}</Label>
            <Textarea
              value={data.primary_audience?.buying_objections || ''}
              onChange={(e) => updateAudienceField('buying_objections', e.target.value)}
              placeholder="What hesitations prevent them from purchasing? (Price, trust, delivery)"
              rows={2}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 4. Buyer Persona */}
      <CollapsibleSection
        title={t('onboarding.s4.buyerPersonaTitle')}
        subtitle={t('onboarding.s4.buyerPersonaSub')}
        icon={Target}
        defaultOpen={true}
      >
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('onboarding.s4.buyerPersonaNotes')}</Label>
          <RichTextEditor
            value={data.customer_notes || ''}
            onChange={(val) => onChange({ ...data, customer_notes: val })}
            placeholder="Detailed narrative describing 'Sarah', 28, her daily routine, preferences, media habits..."
            minHeight="140px"
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}

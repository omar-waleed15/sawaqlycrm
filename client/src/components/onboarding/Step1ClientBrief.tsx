'use client';

import { ClientOnboarding } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Building2,
  FileText,
  Target,
  Users2,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  Flame,
  Volume2,
  ShieldAlert,
  Swords,
  Paintbrush,
} from 'lucide-react';

interface Step1ClientBriefProps {
  onboarding: ClientOnboarding;
  onChange: (updated: ClientOnboarding) => void;
}

export default function Step1ClientBrief({ onboarding, onChange }: Step1ClientBriefProps) {
  const { locale } = useLanguage();
  const isAr = locale === 'ar';

  const overview = onboarding.client_overview || {};
  const discovery = onboarding.business_discovery || {};
  const targetAudience = onboarding.target_audience || {};
  const competitorAnalysis = onboarding.competitor_analysis || {};
  const contentStrategy = onboarding.content_strategy || {};

  // Helper updates
  const updateOverview = (fields: Record<string, any>) => {
    onChange({
      ...onboarding,
      client_overview: {
        ...overview,
        ...fields,
      },
    });
  };

  const updateDiscoveryAbout = (fields: Record<string, any>) => {
    onChange({
      ...onboarding,
      business_discovery: {
        ...discovery,
        about: {
          ...discovery.about,
          ...fields,
        },
      },
    });
  };

  const updateDiscoveryGoals = (fields: Record<string, any>) => {
    onChange({
      ...onboarding,
      business_discovery: {
        ...discovery,
        goals: {
          ...discovery.goals,
          ...fields,
        },
      },
    });
  };

  const updateDiscoveryPainPoints = (val: string) => {
    onChange({
      ...onboarding,
      business_discovery: {
        ...discovery,
        pain_points_notes: val,
      },
    });
  };

  const updateTargetAudience = (fields: Record<string, any>) => {
    onChange({
      ...onboarding,
      target_audience: {
        ...targetAudience,
        primary_audience: {
          ...targetAudience.primary_audience,
          ...fields,
        },
      },
    });
  };

  const updateCompetitorsName = (val: string) => {
    onChange({
      ...onboarding,
      competitor_analysis: {
        ...competitorAnalysis,
        competitor_names: val,
      },
    });
  };

  const updateContentStrategy = (fields: Record<string, any>) => {
    onChange({
      ...onboarding,
      content_strategy: {
        ...contentStrategy,
        ...fields,
      },
    });
  };

  const brandVoiceString = Array.isArray(contentStrategy.brand_voice)
    ? contentStrategy.brand_voice.join(', ')
    : contentStrategy.brand_voice || '';

  const contentStyleString = Array.isArray(contentStrategy.content_style)
    ? contentStrategy.content_style.join(', ')
    : contentStrategy.content_style || '';

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Single Unified Card containing all 13 fields stacked vertically */}
      <Card className="p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-md divide-y divide-slate-100 dark:divide-slate-800/80 space-y-6">

        {/* 1. Business Name */}
        <div className="pt-0 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <Building2 className="size-4" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              1. {isAr ? 'اسم النشاط التجاري (Business Name)' : 'Business Name'} *
            </Label>
          </div>
          <Input
            value={overview.business_name || ''}
            onChange={(e) => updateOverview({ business_name: e.target.value })}
            placeholder={isAr ? 'أدخل اسم النشاط التجاري...' : 'e.g. Acme Agency'}
            className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 2. Business Description */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <FileText className="size-4" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              2. {isAr ? 'وصف النشاط التجاري (Business Description)' : 'Business Description'}
            </Label>
          </div>
          <Textarea
            value={overview.business_description || ''}
            onChange={(e) => updateOverview({ business_description: e.target.value })}
            placeholder={isAr ? 'ملخص قصير عن النشاط التجاري وشغفه...' : 'Brief description of the business...'}
            className="rounded-xl min-h-[90px] border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 3. What the Business Does */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <Sparkles className="size-4" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              3. {isAr ? 'ماذا يقدم أو يفعل البزنس؟ (What the Business Does)' : 'What the Business Does'}
            </Label>
          </div>
          <Textarea
            value={discovery.about?.description || ''}
            onChange={(e) => updateDiscoveryAbout({ description: e.target.value })}
            placeholder={isAr ? 'اشرح بالتفصيل ماذا يفعل النشاط التجاري وكيف يخدم عملائه...' : 'Detail what the business specializes in and how it operates...'}
            className="rounded-xl min-h-[90px] border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 4. Products or Services Offered */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <Flame className="size-4 text-amber-500" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              4. {isAr ? 'المنتجات أو الخدمات المعروضة (Products or Services Offered)' : 'Products / Services Offered'}
            </Label>
          </div>
          <Textarea
            value={discovery.about?.products || discovery.about?.services || ''}
            onChange={(e) => updateDiscoveryAbout({ products: e.target.value, services: e.target.value })}
            placeholder={isAr ? 'اذكر المنتجات أو الخدمات الرئيسية التي يقدمها البزنس...' : 'List the main products or services offered...'}
            className="rounded-xl min-h-[90px] border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 5. USP (Unique Selling Proposition) */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <Target className="size-4 text-emerald-500" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              5. {isAr ? 'الميزة التنافسية الفريدة (USP)' : 'Unique Selling Proposition (USP)'}
            </Label>
          </div>
          <Textarea
            value={discovery.about?.usp || ''}
            onChange={(e) => updateDiscoveryAbout({ usp: e.target.value })}
            placeholder={isAr ? 'ما الذي يميز هذا البزنس عن غيره في السوق؟' : 'What makes this business unique compared to competitors?'}
            className="rounded-xl min-h-[90px] border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 6. Why Did The Client Hire Us */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <HelpCircle className="size-4 text-blue-500" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              6. {isAr ? 'لماذا قام العميل بالتعاقد معنا؟ (Why Did Client Hire Us)' : 'Why Did The Client Hire Us'}
            </Label>
          </div>
          <Textarea
            value={discovery.goals?.why_hired || ''}
            onChange={(e) => updateDiscoveryGoals({ why_hired: e.target.value })}
            placeholder={isAr ? 'السبب الرئيسي الذي جعل العميل يختار شركتنا...' : 'The primary reason the client hired our agency...'}
            className="rounded-xl min-h-[90px] border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 7. Main Business Objective */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <Target className="size-4 text-violet-500" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              7. {isAr ? 'الهدف الرئيسي للبزنس (Main Business Objective)' : 'Main Business Objective'}
            </Label>
          </div>
          <Textarea
            value={discovery.goals?.main_objective || ''}
            onChange={(e) => updateDiscoveryGoals({ main_objective: e.target.value })}
            placeholder={isAr ? 'مثال: زيادة المبيعات بنسبة 30%، بناء الوعي بالعلامة التجارية...' : 'e.g. Increase qualified leads by 30%, build brand awareness...'}
            className="rounded-xl min-h-[90px] border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 8. Pain Points */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
            <AlertTriangle className="size-4" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              8. {isAr ? 'نقاط الألم والمشاكل الحالية (Pain Points)' : 'Pain Points & Challenges'}
            </Label>
          </div>
          <Textarea
            value={discovery.pain_points_notes || ''}
            onChange={(e) => updateDiscoveryPainPoints(e.target.value)}
            placeholder={isAr ? 'ما هي أبرز المشاكل أو العقبات التي يواجهها العميل حالياً؟' : 'Describe the key pain points or obstacles the business currently faces...'}
            className="rounded-xl min-h-[90px] border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-rose-500"
          />
        </div>

        {/* 9. Tone of Voice / Brand Voice */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <Volume2 className="size-4 text-cyan-500" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              9. {isAr ? 'نبرة الصوت والصوت المؤسسي (TOV / Brand Voice)' : 'Tone of Voice (TOV) / Brand Voice'}
            </Label>
          </div>
          <Input
            value={brandVoiceString}
            onChange={(e) => updateContentStrategy({ brand_voice: e.target.value })}
            placeholder={isAr ? 'مثال: احترافي، ودود، يلهم الثقة، حماسي...' : 'e.g. Professional, Friendly, Authoritative, Inspiring'}
            className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 10. Target Audience (Age & Gender) */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <Users2 className="size-4 text-teal-500" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              10. {isAr ? 'الجمهور المستهدف (العمر والجنس)' : 'Target Audience (Age & Gender)'}
            </Label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">{isAr ? 'الفئة العمرية (Age Range)' : 'Age Range'}</Label>
              <Input
                value={targetAudience.primary_audience?.age_range || ''}
                onChange={(e) => updateTargetAudience({ age_range: e.target.value })}
                placeholder={isAr ? 'مثال: 25 - 45' : 'e.g. 25-45 years'}
                className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">{isAr ? 'الجنس (Gender)' : 'Gender'}</Label>
              <Input
                value={targetAudience.primary_audience?.gender || ''}
                onChange={(e) => updateTargetAudience({ gender: e.target.value })}
                placeholder={isAr ? 'الكل / ذكور / إناث' : 'All / Both / Female / Male'}
                className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 11. Competitors Name */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <Swords className="size-4 text-amber-600" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              11. {isAr ? 'أسماء المنافسين (Competitors Name)' : 'Competitors Name'}
            </Label>
          </div>
          <Textarea
            value={competitorAnalysis.competitor_names || ''}
            onChange={(e) => updateCompetitorsName(e.target.value)}
            placeholder={isAr ? 'اذكر أسماء أهم المنافسين في السوق...' : 'List key competitor names...'}
            className="rounded-xl min-h-[90px] border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 12. Content Style */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <Paintbrush className="size-4 text-purple-500" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              12. {isAr ? 'أسلوب المحتوى (Content Style)' : 'Content Style'}
            </Label>
          </div>
          <Input
            value={contentStyleString}
            onChange={(e) => updateContentStrategy({ content_style: e.target.value })}
            placeholder={isAr ? 'مثال: فيديوهات قصيرة Reels، تصاميم بسيطة Minimalist، تعليمي...' : 'e.g. Short-form Reels, Minimalist design, Educational posts'}
            className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 13. What to Avoid */}
        <div className="pt-6 space-y-2.5">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
            <ShieldAlert className="size-4" />
            <Label className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
              13. {isAr ? 'ما يجب تجنبه والمحظورات (What to Avoid)' : 'What to Avoid / Constraints'}
            </Label>
          </div>
          <Textarea
            value={contentStrategy.things_to_avoid || ''}
            onChange={(e) => updateContentStrategy({ things_to_avoid: e.target.value })}
            placeholder={isAr ? 'أذكر الكلمات، الأساليب، المواضيع، أو الأشكال المطلوبة تجنبها تماماً...' : 'Topics, styles, colors, or phrasing that must strictly be avoided...'}
            className="rounded-xl min-h-[90px] border-rose-200 dark:border-rose-900/40 focus:ring-2 focus:ring-rose-500"
          />
        </div>

      </Card>
    </div>
  );
}

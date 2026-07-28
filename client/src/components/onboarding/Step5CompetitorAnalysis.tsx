'use client';

import { OnboardingCompetitorAnalysis, OnboardingCompetitorItem } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import CollapsibleSection from './CollapsibleSection';
import RichTextEditor from './RichTextEditor';
import { Users2, Plus, Trash2, Globe, Share2, Video, BarChart } from 'lucide-react';

interface Step5Props {
  data: OnboardingCompetitorAnalysis;
  onChange: (data: OnboardingCompetitorAnalysis) => void;
}

export default function Step5CompetitorAnalysis({ data = {}, onChange }: Step5Props) {
  const { t } = useLanguage();
  const competitors = data.competitors || [];
  const analysis = data.analysis || {};

  const addCompetitor = () => {
    const newComp: OnboardingCompetitorItem = {
      id: `comp_${Date.now()}`,
      name: '',
      website: '',
      instagram: '',
      tiktok: '',
      facebook: '',
    };
    onChange({
      ...data,
      competitors: [...competitors, newComp],
    });
  };

  const updateCompetitor = (id: string, field: keyof OnboardingCompetitorItem, val: string) => {
    const updated = competitors.map((c) => (c.id === id ? { ...c, [field]: val } : c));
    onChange({
      ...data,
      competitors: updated,
    });
  };

  const removeCompetitor = (id: string) => {
    onChange({
      ...data,
      competitors: competitors.filter((c) => c.id !== id),
    });
  };

  const updateAnalysis = (field: string, val: string) => {
    onChange({
      ...data,
      analysis: {
        ...analysis,
        [field]: val,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Competitors List */}
      <CollapsibleSection
        title={t('onboarding.s5.competitorsTitle')}
        subtitle={t('onboarding.s5.competitorsSub')}
        icon={Users2}
        defaultOpen={true}
        badge={
          <Button
            type="button"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              addCompetitor();
            }}
            className="h-7 text-xs font-semibold rounded-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="size-3.5 mr-1 rtl:ml-1 rtl:mr-0" /> {t('onboarding.s5.addCompetitor')}
          </Button>
        }
      >
        <div className="space-y-4">
          {competitors.length === 0 ? (
            <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500">{t('onboarding.s5.noCompetitors')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCompetitor}
                className="mt-2 text-xs rounded-full"
              >
                <Plus className="size-3.5 mr-1 rtl:ml-1 rtl:mr-0" /> {t('onboarding.s5.addFirstCompetitor')}
              </Button>
            </div>
          ) : (
            competitors.map((comp, idx) => (
              <div
                key={comp.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase font-mono text-indigo-600 dark:text-indigo-400">
                    {t('onboarding.s5.competitorNum').replace('{num}', String(idx + 1))}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 text-slate-400 hover:text-rose-500 rounded"
                    onClick={() => removeCompetitor(comp.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-[11px] font-semibold">{t('onboarding.s5.competitorName')}</Label>
                    <Input
                      value={comp.name}
                      onChange={(e) => updateCompetitor(comp.id, 'name', e.target.value)}
                      placeholder="e.g. Brand X"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">{t('onboarding.s1.website')}</Label>
                    <div className="relative">
                      <Globe className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto" />
                      <Input
                        value={comp.website || ''}
                        onChange={(e) => updateCompetitor(comp.id, 'website', e.target.value)}
                        placeholder="https://brandx.com"
                        className="pl-9 rtl:pr-9 rtl:pl-3 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">{t('onboarding.s1.instagram')}</Label>
                    <div className="relative">
                      <Share2 className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto" />
                      <Input
                        value={comp.instagram || ''}
                        onChange={(e) => updateCompetitor(comp.id, 'instagram', e.target.value)}
                        placeholder="https://instagram.com/brandx"
                        className="pl-9 rtl:pr-9 rtl:pl-3 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">{t('onboarding.s1.tiktok')}</Label>
                    <div className="relative">
                      <Video className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto" />
                      <Input
                        value={comp.tiktok || ''}
                        onChange={(e) => updateCompetitor(comp.id, 'tiktok', e.target.value)}
                        placeholder="https://tiktok.com/@brandx"
                        className="pl-9 rtl:pr-9 rtl:pl-3 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">{t('onboarding.s1.facebook')}</Label>
                    <div className="relative">
                      <Globe className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto" />
                      <Input
                        value={comp.facebook || ''}
                        onChange={(e) => updateCompetitor(comp.id, 'facebook', e.target.value)}
                        placeholder="https://facebook.com/brandx"
                        className="pl-9 rtl:pr-9 rtl:pl-3 h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Full Strategic Analysis Per Competitor */}
                <div className="pt-3 mt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                    {t('onboarding.s5.strategicAnalysisFor').replace('{name}', comp.name || t('onboarding.s5.competitorNum').replace('{num}', String(idx + 1)))}
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{t('onboarding.s5.strengths')}</Label>
                      <Textarea
                        value={comp.strengths || ''}
                        onChange={(e) => updateCompetitor(comp.id, 'strengths', e.target.value)}
                        placeholder="What are they doing very well? (Brand reach, high engagement, strong identity)"
                        rows={2}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{t('onboarding.s5.weaknesses')}</Label>
                      <Textarea
                        value={comp.weaknesses || ''}
                        onChange={(e) => updateCompetitor(comp.id, 'weaknesses', e.target.value)}
                        placeholder="Where are they lacking or failing? (Inconsistent posts, weak CTAs, poor DMs)"
                        rows={2}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{t('onboarding.s5.contentStyle')}</Label>
                      <Textarea
                        value={comp.content_style || ''}
                        onChange={(e) => updateCompetitor(comp.id, 'content_style', e.target.value)}
                        placeholder="What content formats do they use? (High production, UGC, Reels, Carousels)"
                        rows={2}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{t('onboarding.s5.doingWell')}</Label>
                      <Textarea
                        value={comp.doing_well || ''}
                        onChange={(e) => updateCompetitor(comp.id, 'doing_well', e.target.value)}
                        placeholder="Key tactics, viral video hooks, or offer strategies working for them"
                        rows={2}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-[11px] font-semibold">{t('onboarding.s5.missing')}</Label>
                      <Textarea
                        value={comp.missing || ''}
                        onChange={(e) => updateCompetitor(comp.id, 'missing', e.target.value)}
                        placeholder="Unserved customer needs, missing content angles, or weak community management"
                        rows={2}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-[11px] font-semibold">{t('onboarding.s5.opportunities')}</Label>
                      <Textarea
                        value={comp.opportunities || ''}
                        onChange={(e) => updateCompetitor(comp.id, 'opportunities', e.target.value)}
                        placeholder="How can our agency position our client to win against this competitor?"
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}

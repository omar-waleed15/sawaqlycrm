'use client';

import { Check, FileText, Layers } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export interface StepInfo {
  number: number;
  titleKey: string;
  shortTitleKey: string;
  icon: React.ElementType;
}

export const ONBOARDING_STEPS: StepInfo[] = [
  { number: 1, titleKey: 'onboarding.step1.briefTitle', shortTitleKey: 'onboarding.step1.briefTitle', icon: FileText },
  { number: 2, titleKey: 'onboarding.step2.advancedTitle', shortTitleKey: 'onboarding.step2.advancedTitle', icon: Layers },
];

interface OnboardingProgressProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (stepNumber: number) => void;
  saving?: boolean;
  lastSavedAt?: Date | null;
}

export default function OnboardingProgress({
  currentStep,
  completedSteps = [],
  onStepClick,
  saving = false,
  lastSavedAt = null,
}: OnboardingProgressProps) {
  const { t } = useLanguage();
  const percentComplete = Math.round((completedSteps.length / ONBOARDING_STEPS.length) * 100);

  return (
    <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs py-3 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Header & Status Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              {t('onboarding.title')}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/60">
              {percentComplete}% {t('common.done') || 'Complete'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {saving ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
                <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                {t('onboarding.saving')}
              </span>
            ) : lastSavedAt ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="size-3.5" />
                {t('onboarding.saved')}
              </span>
            ) : null}
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-violet-600 h-full transition-all duration-500 ease-out"
            style={{ width: `${percentComplete}%` }}
          />
        </div>

        {/* 7 Steps Navigation Bar */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-1">
          {ONBOARDING_STEPS.map((step) => {
            const Icon = step.icon;
            const isCompleted = completedSteps.includes(step.number);
            const isCurrent = currentStep === step.number;

            return (
              <button
                key={step.number}
                type="button"
                onClick={() => onStepClick(step.number)}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all border whitespace-nowrap ${
                  isCurrent
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-none'
                    : isCompleted
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100/60'
                    : 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div
                  className={`size-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-transform ${
                    isCurrent
                      ? 'bg-white/20 text-white'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isCompleted ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                </div>

                <div className="text-start">
                  <div className="text-[10px] uppercase tracking-wider font-mono opacity-80 leading-none">
                    {t('common.tasks') || 'Step'} {step.number}
                  </div>
                  <div className="text-xs font-semibold leading-tight mt-0.5 whitespace-nowrap">{t(step.titleKey)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

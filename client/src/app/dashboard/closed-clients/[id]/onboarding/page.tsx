'use client';

import { useEffect, useState, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { clientsApi, clientOnboardingApi } from '@/lib/api';
import { Client, ClientOnboarding } from '@/types';
import OnboardingProgress, { ONBOARDING_STEPS } from '@/components/onboarding/OnboardingProgress';
import Step1ClientOverview from '@/components/onboarding/Step1ClientOverview';
import Step2BrandAssets from '@/components/onboarding/Step2BrandAssets';
import Step3BusinessDiscovery from '@/components/onboarding/Step3BusinessDiscovery';
import Step4TargetAudience from '@/components/onboarding/Step4TargetAudience';
import Step5CompetitorAnalysis from '@/components/onboarding/Step5CompetitorAnalysis';
import Step6SocialMediaAudit from '@/components/onboarding/Step6SocialMediaAudit';
import Step7ContentStrategy from '@/components/onboarding/Step7ContentStrategy';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Save,
  CheckCircle2,
  Building2,
  Loader2,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClosedClientOnboardingPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const initialParamId = resolvedParams.id;

  const { user } = useAuth();
  const router = useRouter();

  const { t, locale } = useLanguage();

  // Navigation Guard
  useEffect(() => {
    if (user && !['owner', 'team_leader', 'sales', 'account_manager', 'moderation', 'content_creator'].includes(user.role)) {
      router.replace('/dashboard/closed-clients');
    }
  }, [user, router]);

  const [activeClientId, setActiveClientId] = useState<string>(initialParamId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [client, setClient] = useState<Client | null>(null);
  const [onboarding, setOnboarding] = useState<ClientOnboarding | null>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Fetch initial onboarding & client data
  const loadData = useCallback(async () => {
    if (activeClientId === 'new') {
      // New Client Mode
      setClient({
        id: 'new',
        name: '',
        company: '',
        status: 'active',
        pipeline_stage: 'won',
        created_at: new Date().toISOString(),
      });
      setOnboarding({
        client_id: 'new',
        current_step: 1,
        completed_steps: [],
        client_overview: {
          business_name: '',
          company_status: 'Active Client',
        },
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await clientOnboardingApi.get(activeClientId);
      setClient(res.client);
      setOnboarding(res.onboarding);
      setCurrentStep(res.onboarding.current_step || 1);
      setCompletedSteps(res.onboarding.completed_steps || []);
    } catch (err: any) {
      console.error('Failed to load onboarding:', err);
      setErrorMsg(err.message || 'Failed to load client directory');
    } finally {
      setLoading(false);
    }
  }, [activeClientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Execute Save
  const saveOnboarding = async (dataToSave = onboarding, stepToMark = currentStep) => {
    if (!dataToSave) return;
    setSaving(true);

    try {
      let targetId = activeClientId;

      // Handle NEW client creation first if client ID is 'new'
      if (targetId === 'new') {
        const overview = dataToSave.client_overview || {};
        const businessName = overview.business_name?.trim() || (locale === 'ar' ? 'عميل جديد' : 'New Client');

        const createdRes = await clientsApi.create({
          name: businessName,
          company: businessName,
          email: overview.owner_email || overview.primary_contact_email || overview.email || '',
          phone: overview.owner_phone || overview.primary_contact_phone || overview.phone || '',
          address: overview.address || '',
          status: 'active',
          pipeline_stage: 'won',
        });

        if (createdRes?.client?.id) {
          targetId = createdRes.client.id;
          setActiveClientId(targetId);
          setClient(createdRes.client);
          // Replace URL cleanly without full page re-render
          window.history.replaceState({}, '', `/dashboard/closed-clients/${targetId}/onboarding`);
        } else {
          throw new Error('Failed to create new client record');
        }
      }

      const updatedCompleted = Array.from(new Set([...completedSteps, stepToMark]));
      setCompletedSteps(updatedCompleted);

      const payload: Partial<ClientOnboarding> = {
        ...dataToSave,
        client_id: targetId,
        current_step: currentStep,
        completed_steps: updatedCompleted,
      };

      const res = await clientOnboardingApi.update(targetId, payload);
      if (res.onboarding) {
        setOnboarding(res.onboarding);
        setLastSavedAt(new Date());
      }
    } catch (err: any) {
      console.error('Failed to save onboarding:', err);
    } finally {
      setSaving(false);
    }
  };

  // Debounced Auto-save when onboarding object changes
  const triggerAutoSave = (updatedData: ClientOnboarding) => {
    setOnboarding(updatedData);

    // Keep header name synced with overview business name
    if (updatedData.client_overview?.business_name && client) {
      setClient({
        ...client,
        name: updatedData.client_overview.business_name,
        company: updatedData.client_overview.business_name,
      });
    }

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveOnboarding(updatedData, currentStep);
    }, 1200);
  };

  // Navigation handlers
  const handleNext = async () => {
    await saveOnboarding(onboarding, currentStep);
    if (currentStep < ONBOARDING_STEPS.length) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = async () => {
    await saveOnboarding(onboarding, currentStep);
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepClick = async (stepNum: number) => {
    await saveOnboarding(onboarding, currentStep);
    setCurrentStep(stepNum);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <Loader2 className="size-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  if (errorMsg || !client || !onboarding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center max-w-md">
          <Building2 className="size-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('common.noData')}</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMsg || 'Unable to locate client record.'}</p>
          <Link href="/dashboard/closed-clients">
            <Button variant="outline" className="rounded-full text-xs">
              <ArrowLeft className="size-3.5 mr-1.5 rtl:ml-1.5 rtl:mr-0 rtl:rotate-180" /> {t('onboarding.backToClosedClients')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 pb-20">
      {/* Header Top Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={activeClientId === 'new' ? '/dashboard/closed-clients' : `/dashboard/closed-clients/${activeClientId}`}>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <ArrowLeft className="size-4 mr-1 rtl:ml-1 rtl:mr-0 rtl:rotate-180" /> {activeClientId === 'new' ? t('onboarding.backToClosedClients') : t('onboarding.backToPortal')}
              </Button>
            </Link>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {client.company || client.name || (locale === 'ar' ? 'إعداد عميل جديد' : 'New Client Setup')}
                </h1>
                <Badge variant="outline" className="text-xs font-semibold capitalize">
                  {onboarding.client_overview?.company_status || client.status || 'Active Client'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {t('onboarding.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={() => saveOnboarding(onboarding, currentStep)}
              disabled={saving}
              className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 rtl:ml-1.5 rtl:mr-0 animate-spin" /> {t('onboarding.saving')}
                </>
              ) : (
                <>
                  <Save className="size-3.5 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('onboarding.saveChanges')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Sticky Progress Indicator */}
      <OnboardingProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
        saving={saving}
        lastSavedAt={lastSavedAt}
      />

      {/* Main Form Content Container */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold font-mono uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              {t('onboarding.stepOf').replace('{current}', String(currentStep)).replace('{total}', String(ONBOARDING_STEPS.length))}
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {t(ONBOARDING_STEPS[currentStep - 1]?.titleKey)}
            </h2>
          </div>
        </div>

        {/* Dynamic Step View */}
        <div className="transition-all duration-300">
          {currentStep === 1 && (
            <Step1ClientOverview
              data={onboarding.client_overview || {}}
              onChange={(data) => triggerAutoSave({ ...onboarding, client_overview: data })}
            />
          )}

          {currentStep === 2 && (
            <Step2BrandAssets
              clientId={activeClientId}
              data={onboarding.brand_assets || {}}
              onChange={(data) => triggerAutoSave({ ...onboarding, brand_assets: data })}
            />
          )}

          {currentStep === 3 && (
            <Step3BusinessDiscovery
              data={onboarding.business_discovery || {}}
              onChange={(data) => triggerAutoSave({ ...onboarding, business_discovery: data })}
            />
          )}

          {currentStep === 4 && (
            <Step4TargetAudience
              data={onboarding.target_audience || {}}
              onChange={(data) => triggerAutoSave({ ...onboarding, target_audience: data })}
            />
          )}

          {currentStep === 5 && (
            <Step5CompetitorAnalysis
              data={onboarding.competitor_analysis || {}}
              onChange={(data) => triggerAutoSave({ ...onboarding, competitor_analysis: data })}
            />
          )}

          {currentStep === 6 && (
            <Step6SocialMediaAudit
              data={onboarding.social_media_audit || {}}
              onChange={(data) => triggerAutoSave({ ...onboarding, social_media_audit: data })}
            />
          )}

          {currentStep === 7 && (
            <Step7ContentStrategy
              data={onboarding.content_strategy || {}}
              onChange={(data) => triggerAutoSave({ ...onboarding, content_strategy: data })}
            />
          )}
        </div>

        {/* Bottom Wizard Controls */}
        <div className="mt-10 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="rounded-full text-xs font-semibold px-5"
          >
            <ChevronLeft className="size-4 mr-1 rtl:ml-1 rtl:mr-0 rtl:rotate-180" /> {t('onboarding.prevStep')}
          </Button>

          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            {t('onboarding.stepOf').replace('{current}', String(currentStep)).replace('{total}', String(ONBOARDING_STEPS.length))}
          </div>

          {currentStep < ONBOARDING_STEPS.length ? (
            <Button
              type="button"
              onClick={handleNext}
              className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-6 shadow-sm"
            >
              {t('onboarding.nextStep')} <ChevronRight className="size-4 ml-1 rtl:mr-1 rtl:ml-0 rtl:rotate-180" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={async () => {
                await saveOnboarding(onboarding, 7);
                router.push(activeClientId === 'new' ? '/dashboard/closed-clients' : `/dashboard/closed-clients/${activeClientId}`);
              }}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-6 shadow-sm"
            >
              {t('onboarding.complete')} <CheckCircle2 className="size-4 ml-1.5 rtl:mr-1.5 rtl:ml-0" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

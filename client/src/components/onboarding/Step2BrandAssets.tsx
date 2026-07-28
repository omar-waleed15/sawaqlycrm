'use client';

import { useState } from 'react';
import { OnboardingBrandAssets, OnboardingUploadedFile } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import CollapsibleSection from './CollapsibleSection';
import FileUploadZone from './FileUploadZone';
import { Image as ImageIcon, Palette, Link2, Plus, X } from 'lucide-react';

interface Step2Props {
  clientId: string;
  data: OnboardingBrandAssets;
  onChange: (data: OnboardingBrandAssets) => void;
}

export default function Step2BrandAssets({ clientId, data = {}, onChange }: Step2Props) {
  const { t } = useLanguage();
  const [newHexColor, setNewHexColor] = useState('#1D61E7');

  const BRAND_FILE_CATEGORIES = [
    { key: 'primary_logo', label: t('onboarding.s2.primaryLogo'), desc: t('onboarding.s2.primaryLogoDesc') },
    { key: 'marketing_materials', label: t('onboarding.s2.marketingMaterials'), desc: t('onboarding.s2.marketingMaterialsDesc') },
  ];

  const updateField = (field: keyof OnboardingBrandAssets, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleFileUploaded = (file: OnboardingUploadedFile) => {
    const existing = data.uploaded_files || [];
    updateField('uploaded_files', [...existing, file]);
  };

  const handleFileDeleted = (storagePath: string) => {
    const existing = data.uploaded_files || [];
    updateField(
      'uploaded_files',
      existing.filter((f) => f.storage_path !== storagePath)
    );
  };

  const addColor = (hex: string) => {
    if (!hex) return;
    const current = data.color_palette || [];
    if (!current.includes(hex)) {
      updateField('color_palette', [...current, hex]);
    }
  };

  const removeColor = (hex: string) => {
    const current = data.color_palette || [];
    updateField(
      'color_palette',
      current.filter((c) => c !== hex)
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Upload Assets */}
      <CollapsibleSection
        title={t('onboarding.s2.uploadTitle')}
        subtitle={t('onboarding.s2.uploadSub')}
        icon={ImageIcon}
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {BRAND_FILE_CATEGORIES.map((cat) => (
            <FileUploadZone
              key={cat.key}
              clientId={clientId}
              category={cat.key}
              label={cat.label}
              description={cat.desc}
              files={data.uploaded_files || []}
              onFileUploaded={handleFileUploaded}
              onFileDeleted={handleFileDeleted}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* 2. Color Palette & Typography */}
      <CollapsibleSection
        title={t('onboarding.s2.colorsTitle')}
        subtitle={t('onboarding.s2.colorsSub')}
        icon={Palette}
        defaultOpen={true}
      >
        <div className="space-y-5">
        <div className="space-y-6">
          {/* Structured Brand Colors Grid */}
          <div>
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 block">
              {t('onboarding.s2.coreColors')}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* 1. Primary Color */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{t('onboarding.s2.primaryColor')}</span>
                  <div
                    className="size-5 rounded-full border border-black/10 shadow-2xs"
                    style={{ backgroundColor: data.primary_color || '#1D61E7' }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.primary_color || '#1D61E7'}
                    onChange={(e) => updateField('primary_color', e.target.value)}
                    className="size-8 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700 bg-transparent p-0.5 shrink-0"
                  />
                  <Input
                    value={data.primary_color || ''}
                    onChange={(e) => updateField('primary_color', e.target.value)}
                    placeholder="#1D61E7"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>
              </div>

              {/* 2. Secondary Color */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{t('onboarding.s2.secondaryColor')}</span>
                  <div
                    className="size-5 rounded-full border border-black/10 shadow-2xs"
                    style={{ backgroundColor: data.secondary_color || '#6366F1' }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.secondary_color || '#6366F1'}
                    onChange={(e) => updateField('secondary_color', e.target.value)}
                    className="size-8 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700 bg-transparent p-0.5 shrink-0"
                  />
                  <Input
                    value={data.secondary_color || ''}
                    onChange={(e) => updateField('secondary_color', e.target.value)}
                    placeholder="#6366F1"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>
              </div>

              {/* 3. Accent Color */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{t('onboarding.s2.accentColor')}</span>
                  <div
                    className="size-5 rounded-full border border-black/10 shadow-2xs"
                    style={{ backgroundColor: data.accent_color || '#F59E0B' }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.accent_color || '#F59E0B'}
                    onChange={(e) => updateField('accent_color', e.target.value)}
                    className="size-8 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700 bg-transparent p-0.5 shrink-0"
                  />
                  <Input
                    value={data.accent_color || ''}
                    onChange={(e) => updateField('accent_color', e.target.value)}
                    placeholder="#F59E0B"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>
              </div>

              {/* 4. Background / Neutral Color */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{t('onboarding.s2.neutralColor')}</span>
                  <div
                    className="size-5 rounded-full border border-black/10 shadow-2xs"
                    style={{ backgroundColor: data.background_color || '#F8FAFC' }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.background_color || '#F8FAFC'}
                    onChange={(e) => updateField('background_color', e.target.value)}
                    className="size-8 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700 bg-transparent p-0.5 shrink-0"
                  />
                  <Input
                    value={data.background_color || ''}
                    onChange={(e) => updateField('background_color', e.target.value)}
                    placeholder="#F8FAFC"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Colors List */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Label className="text-xs font-semibold">{t('onboarding.s2.additionalColors')}</Label>
            <div className="flex flex-wrap items-center gap-3">
              {(data.color_palette || []).map((hex) => (
                <div
                  key={hex}
                  className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs"
                >
                  <span
                    className="size-6 rounded-full border border-black/10 shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {hex}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeColor(hex)}
                    className="text-slate-400 hover:text-rose-500 rounded-full"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newHexColor}
                  onChange={(e) => setNewHexColor(e.target.value)}
                  className="size-8 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700 bg-transparent p-0.5 shrink-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addColor(newHexColor)}
                  className="h-8 rounded-full text-xs font-semibold"
                >
                  <Plus className="size-3.5 mr-1 rtl:ml-1 rtl:mr-0" /> {t('onboarding.s2.addExtraColor')}
                </Button>
              </div>
            </div>
          </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s2.typography')}</Label>
            <Input
              value={data.typography || ''}
              onChange={(e) => updateField('typography', e.target.value)}
              placeholder={t('onboarding.s2.typographyPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('onboarding.s2.moodboard')}</Label>
            <div className="relative">
              <Link2 className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto" />
              <Input
                value={data.moodboard_links || ''}
                onChange={(e) => updateField('moodboard_links', e.target.value)}
                placeholder="https://pinterest.com/... or https://behance.net/..."
                className="pl-9 rtl:pr-9 rtl:pl-3"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

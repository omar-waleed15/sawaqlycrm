'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { rolesApi, RoleData } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  CheckCircle2,
  Save,
  UserCog,
  FileText,
  Briefcase,
  CheckSquare,
  AlertOctagon,
} from 'lucide-react';

const ROLE_EMOJIS: Record<string, string> = {
  team_leader: '👑',
  sales: '💼',
  member: '👤',
  graphic_designer: '🎨',
  video_editor: '🎬',
  reel_maker: '📱',
  moderation: '🛡️',
  account_manager: '📋',
  content_creator: '🎥',
  content_creator_intern: '🎥',
};

type SectionKey = 'general_roles' | 'job_description' | 'job_roles' | 'non_negotiables';

interface SectionConfig {
  key: SectionKey;
  icon: React.ElementType;
  labelKey: string;
  placeholderKey: string;
  colorClass: string;
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'general_roles',
    icon: FileText,
    labelKey: 'roles.section.general_roles',
    placeholderKey: 'roles.placeholder.general_roles',
    colorClass: 'text-blue-500',
  },
  {
    key: 'job_description',
    icon: Briefcase,
    labelKey: 'roles.section.job_description',
    placeholderKey: 'roles.placeholder.job_description',
    colorClass: 'text-purple-500',
  },
  {
    key: 'job_roles',
    icon: CheckSquare,
    labelKey: 'roles.section.job_roles',
    placeholderKey: 'roles.placeholder.job_roles',
    colorClass: 'text-emerald-500',
  },
  {
    key: 'non_negotiables',
    icon: AlertOctagon,
    labelKey: 'roles.section.non_negotiables',
    placeholderKey: 'roles.placeholder.non_negotiables',
    colorClass: 'text-rose-500',
  },
];

export default function RolesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'owner';

  const [roles, setRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Record<SectionKey, string>>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await rolesApi.list();
      setRoles(data.roles);
      const d: Record<string, Record<SectionKey, string>> = {};
      data.roles.forEach((r) => {
        d[r.role_key] = {
          general_roles: r.general_roles || '',
          job_description: r.job_description || '',
          job_roles: r.job_roles || '',
          non_negotiables: r.non_negotiables || '',
        };
      });
      setDrafts(d);
    } catch (err) {
      console.error('Failed to load roles', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleSave = async (roleKey: string) => {
    setSavingKey(roleKey);
    setSavedKey(null);
    try {
      const payload = drafts[roleKey] || {
        general_roles: '',
        job_description: '',
        job_roles: '',
        non_negotiables: '',
      };
      await rolesApi.update(roleKey, payload);
      setRoles(prev => prev.map(r => r.role_key === roleKey ? { ...r, ...payload } : r));
      setSavedKey(roleKey);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (err) {
      console.error('Failed to save role', err);
    } finally {
      setSavingKey(null);
    }
  };

  const handleDraftChange = (roleKey: string, field: SectionKey, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [roleKey]: {
        ...(prev[roleKey] || { general_roles: '', job_description: '', job_roles: '', non_negotiables: '' }),
        [field]: value,
      },
    }));
  };

  const isDirty = (roleKey: string) => {
    const original = roles.find((r) => r.role_key === roleKey);
    if (!original) return false;
    const currentDraft = drafts[roleKey];
    if (!currentDraft) return false;
    return (
      (currentDraft.general_roles ?? '') !== (original.general_roles ?? '') ||
      (currentDraft.job_description ?? '') !== (original.job_description ?? '') ||
      (currentDraft.job_roles ?? '') !== (original.job_roles ?? '') ||
      (currentDraft.non_negotiables ?? '') !== (original.non_negotiables ?? '')
    );
  };

  if (loading) {
    return (
      <div className="page-container fade-in">
        <div className="flex justify-center py-24">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fade-in text-start space-y-6">
      {/* Header */}
      <div className="page-header mb-6">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('roles.title')}</h1>
          <p className="page-header-subtitle">{t('roles.subtitle')}</p>
        </div>
      </div>

      {/* Admin View — 4 Section text boxes per role */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-6">
          {roles.map((role) => {
            const emoji = ROLE_EMOJIS[role.role_key] || '🔹';
            const roleDraft = drafts[role.role_key] || {
              general_roles: '',
              job_description: '',
              job_roles: '',
              non_negotiables: '',
            };

            return (
              <Card key={role.role_key} className="px-5 py-4">
                <CardContent className="p-0 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <span>{emoji}</span>
                      {t(`roles.role.${role.role_key}`)}
                    </h2>
                    <div className="flex items-center gap-3">
                      {savedKey === role.role_key && (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle2 className="size-3.5" />
                          {t('roles.saved')}
                        </span>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleSave(role.role_key)}
                        disabled={savingKey === role.role_key || !isDirty(role.role_key)}
                      >
                        {savingKey === role.role_key ? (
                          <><Loader2 className="size-3.5 animate-spin mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('roles.saving')}</>
                        ) : (
                          <><Save className="size-3.5 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('roles.save')}</>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* 4 Section Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SECTIONS.map((sec) => {
                      const Icon = sec.icon;
                      return (
                        <div key={sec.key} className="flex flex-col gap-1.5">
                          <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                            <Icon className={`size-3.5 ${sec.colorClass}`} />
                            {t(sec.labelKey)}
                          </Label>
                          <Textarea
                            value={roleDraft[sec.key] || ''}
                            onChange={(e) => handleDraftChange(role.role_key, sec.key, e.target.value)}
                            placeholder={t(sec.placeholderKey)}
                            className="min-h-[100px] text-sm resize-y"
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Non-Admin View — Read-only 4 sections display */}
      {!isAdmin && (
        <div className="grid grid-cols-1 gap-6">
          {roles.length === 0 ? (
            <Card className="p-8">
              <CardContent className="p-0 flex flex-col items-center justify-center text-center gap-2">
                <UserCog className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('roles.noDescription')}</p>
              </CardContent>
            </Card>
          ) : (
            roles.map((role) => {
              const emoji = ROLE_EMOJIS[role.role_key] || '🔹';
              const hasAnyContent = SECTIONS.some(sec => !!role[sec.key]);

              return (
                <Card key={role.role_key} className="px-5 py-4">
                  <CardContent className="p-0 flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b pb-3">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        <span>{emoji}</span>
                        {t(`roles.role.${role.role_key}`)}
                      </h2>
                      <Badge variant="outline" className="text-[11px] px-2 py-0.5">
                        {t('roles.yourRole')}
                      </Badge>
                    </div>

                    {!hasAnyContent ? (
                      <p className="text-sm text-muted-foreground italic py-2">{t('roles.noDescription')}</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {SECTIONS.map((sec) => {
                          const Icon = sec.icon;
                          const content = role[sec.key];
                          if (!content) return null;

                          return (
                            <div key={sec.key} className="p-3.5 rounded-lg border bg-card/60 flex flex-col gap-1.5">
                              <span className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                                <Icon className={`size-3.5 ${sec.colorClass}`} />
                                {t(sec.labelKey)}
                              </span>
                              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                                {content}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

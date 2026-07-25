'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { rolesApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CheckCircle2,
  Save,
  UserCog,
} from 'lucide-react';

interface RoleDescription {
  id: string;
  role_key: string;
  description: string;
  updated_at: string;
  updated_by: string | null;
}

const ROLE_EMOJIS: Record<string, string> = {
  team_leader: '👑',
  sales: '💼',
  member: '👤',
  moderation: '🛡️',
  account_manager: '📋',
  content_creator: '🎨',
};

export default function RolesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'owner';

  const [roles, setRoles] = useState<RoleDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await rolesApi.list();
      setRoles(data.roles);
      const d: Record<string, string> = {};
      data.roles.forEach((r) => {
        d[r.role_key] = r.description;
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
      await rolesApi.update(roleKey, drafts[roleKey] ?? '');
      setRoles(prev => prev.map(r => r.role_key === roleKey ? { ...r, description: drafts[roleKey] ?? '' } : r));
      setSavedKey(roleKey);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (err) {
      console.error('Failed to save role', err);
    } finally {
      setSavingKey(null);
    }
  };

  const handleDraftChange = (roleKey: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [roleKey]: value }));
  };

  const isDirty = (roleKey: string) => {
    const original = roles.find((r) => r.role_key === roleKey);
    return original ? drafts[roleKey] !== original.description : false;
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

      {/* Admin View — Simple clean cards */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-4">
          {roles.map((role) => {
            const emoji = ROLE_EMOJIS[role.role_key] || '🔹';

            return (
              <Card key={role.role_key} className="px-5 py-3.5">
                <CardContent className="p-0 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <span>{emoji}</span>
                      {t(`roles.role.${role.role_key}`)}
                    </h2>
                    {savedKey === role.role_key && (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                        <CheckCircle2 className="size-3.5" />
                        {t('roles.saved')}
                      </span>
                    )}
                  </div>

                  <Textarea
                    value={drafts[role.role_key] ?? ''}
                    onChange={(e) => handleDraftChange(role.role_key, e.target.value)}
                    placeholder={t('roles.descriptionPlaceholder')}
                    className="min-h-[140px] text-sm"
                  />

                  <div className="flex justify-end">
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Non-Admin View — Simple clean read-only */}
      {!isAdmin && (
        <div className="grid grid-cols-1 gap-4">
          {roles.length === 0 || roles.every(r => !r.description) ? (
            <Card className="p-8">
              <CardContent className="p-0 flex flex-col items-center justify-center text-center gap-2">
                <UserCog className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('roles.noDescription')}</p>
              </CardContent>
            </Card>
          ) : (
            roles.map((role) => {
              const emoji = ROLE_EMOJIS[role.role_key] || '🔹';

              return (
                <Card key={role.role_key} className="px-5 py-3.5">
                  <CardContent className="p-0 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold flex items-center gap-2">
                        <span>{emoji}</span>
                        {t(`roles.role.${role.role_key}`)}
                      </h2>
                      <Badge variant="outline" className="text-[11px] px-2 py-0.5">
                        {t('roles.yourRole')}
                      </Badge>
                    </div>

                    {role.description ? (
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed pt-1">
                        {role.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic pt-1">{t('roles.noDescription')}</p>
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

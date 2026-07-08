'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/i18n';
import { usersApi, clientsApi } from '@/lib/api';
import { Client, User } from '@/types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  UserCog,
  Mail,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit,
  Plus,
  KeyRound,
  Calendar,
} from 'lucide-react';

interface ClosedClientAccountProps {
  client: Client;
  onClientUpdated: () => void;
}

export default function ClosedClientAccount({ client, onClientUpdated }: ClosedClientAccountProps) {
  const { t } = useLanguage();

  // Linked user state
  const [linkedUser, setLinkedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [createName, setCreateName] = useState(client.name || '');
  const [createEmail, setCreateEmail] = useState(client.email || '');
  const [createPassword, setCreatePassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Edit credentials modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Remove confirm state
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Load linked user info
  const loadLinkedUser = useCallback(async () => {
    if (!client.user_id) {
      setLinkedUser(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await usersApi.list();
      const found = res.users.find(u => u.id === client.user_id);
      setLinkedUser(found || null);
    } catch {
      setLinkedUser(null);
    } finally {
      setLoading(false);
    }
  }, [client.user_id]);

  useEffect(() => {
    loadLinkedUser();
  }, [loadLinkedUser]);

  // Create client account
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail || !createPassword) {
      setCreateError(t('team.fieldsRequired'));
      return;
    }
    if (createPassword.length < 6) {
      setCreateError('Password must be at least 6 characters');
      return;
    }

    setCreating(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      // 1. Create user with role 'client'
      const userRes = await usersApi.create({
        name: createName || client.name,
        email: createEmail,
        password: createPassword,
        role: 'client',
      });

      // 2. Link user_id to the client record
      await clientsApi.update(client.id, { user_id: userRes.user.id } as Partial<Client>);

      setCreateSuccess(t('closedClients.account.created'));
      setCreatePassword('');

      // Refresh parent data
      setTimeout(() => {
        onClientUpdated();
      }, 1000);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  // Edit credentials
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedUser) return;
    if (!editName || !editEmail) {
      setEditError(t('team.fieldsRequired'));
      return;
    }

    const hasChanges =
      editName.trim() !== (linkedUser.name || '').trim() ||
      editEmail.trim() !== (linkedUser.email || '').trim() ||
      editPassword.trim() !== '';

    if (!hasChanges) {
      setEditError('No changes detected');
      return;
    }

    if (editPassword && editPassword.length < 6) {
      setEditError('Password must be at least 6 characters');
      return;
    }

    setEditSubmitting(true);
    setEditError('');
    setEditSuccess('');

    try {
      await usersApi.update(linkedUser.id, {
        name: editName,
        email: editEmail,
        password: editPassword || undefined,
      });
      setEditSuccess(t('closedClients.account.updated'));
      setTimeout(() => {
        setIsEditOpen(false);
        setEditPassword('');
        setEditSuccess('');
        loadLinkedUser();
        onClientUpdated();
      }, 1500);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update credentials');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Remove account
  const handleRemove = async () => {
    if (!linkedUser) return;
    setRemoving(true);
    try {
      // 1. Unlink from client record
      await clientsApi.update(client.id, { user_id: null } as any);
      // 2. Delete the user account
      await usersApi.delete(linkedUser.id);
      setShowRemoveConfirm(false);
      onClientUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to remove account');
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Linked Account View ─────────────────────────────────────────────
  if (linkedUser) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="mb-2">
          <h2 className="text-xl font-bold text-foreground">{t('closedClients.account.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1.5">{t('closedClients.account.desc')}</p>
        </div>

        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-4 px-6 pt-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserCog className="size-5 text-[#1D61E7]" />
                {t('closedClients.account.linked')}
              </CardTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/30 flex items-center">
                <span className="size-1.5 rounded-full bg-green-500 mr-1.5 rtl:ml-1.5 rtl:mr-0 animate-pulse" />
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 flex flex-col gap-6">
            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-full bg-gradient-to-br from-[#1D61E7] to-indigo-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
                {linkedUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg text-foreground truncate leading-snug">{linkedUser.name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Mail className="size-4 shrink-0 text-muted-foreground/75" />
                  <span className="truncate">{linkedUser.email}</span>
                </div>
              </div>
            </div>

            {/* Structured Details List */}
            <div className="space-y-1.5 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between py-2 text-sm">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Shield className="size-4 text-muted-foreground/80" />
                  <span className="font-medium">{t('team.role')}</span>
                </div>
                <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground hover:bg-muted/80 font-normal px-2.5 py-0.5">
                  {t('role.client')}
                </Badge>
              </div>

              {linkedUser.created_at && (
                <div className="flex items-center justify-between py-2 text-sm border-t border-border/40">
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Calendar className="size-4 text-muted-foreground/80" />
                    <span className="font-medium">{t('common.createdAt')}</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {new Date(linkedUser.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end pt-5 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 text-sm"
                onClick={() => {
                  setEditName(linkedUser.name);
                  setEditEmail(linkedUser.email);
                  setEditPassword('');
                  setEditError('');
                  setEditSuccess('');
                  setIsEditOpen(true);
                }}
              >
                <Edit className="size-3.5" />
                {t('closedClients.account.editCredentials')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 text-sm text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-950/20"
                onClick={() => setShowRemoveConfirm(true)}
              >
                <Trash2 className="size-3.5" />
                {t('closedClients.account.unlinkAccount')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Edit Credentials Modal */}
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={t('closedClients.account.editCredentials')}
        >
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4 text-start">
            {editError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2.5 rounded-md font-medium">
                {editError}
              </div>
            )}
            {editSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2.5 rounded-md font-medium flex items-center gap-2 dark:bg-green-950/20 dark:border-green-900/30 dark:text-green-300">
                <CheckCircle2 className="size-4 shrink-0" />
                {editSuccess}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-client-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('closedClients.account.name')}
              </Label>
              <Input
                id="edit-client-name"
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                required
                autoComplete="off"
                className="h-10 px-3 bg-background border border-input rounded-md focus-visible:ring-2 focus-visible:ring-[#1D61E7] focus-visible:ring-offset-2"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-client-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('closedClients.account.email')}
              </Label>
              <Input
                id="edit-client-email"
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                required
                autoComplete="off"
                className="h-10 px-3 bg-background border border-input rounded-md focus-visible:ring-2 focus-visible:ring-[#1D61E7] focus-visible:ring-offset-2"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-client-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('closedClients.account.password')}
              </Label>
              <Input
                id="edit-client-password"
                type="password"
                placeholder="••••••••"
                value={editPassword}
                onChange={e => setEditPassword(e.target.value)}
                autoComplete="new-password"
                className="h-10 px-3 bg-background border border-input rounded-md focus-visible:ring-2 focus-visible:ring-[#1D61E7] focus-visible:ring-offset-2"
              />
            </div>

            <div className="flex justify-end gap-2 mt-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={editSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={editSubmitting || !(editName.trim() !== (linkedUser.name || '').trim() || editEmail.trim() !== (linkedUser.email || '').trim() || editPassword.trim() !== '')}>
                {editSubmitting ? (
                  <><Loader2 className="size-4 animate-spin mr-1.5" /> {t('common.loading')}</>
                ) : (
                  <><KeyRound className="size-4 mr-1.5" /> {t('closedClients.account.editCredentials')}</>
                )}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Remove Confirm Modal */}
        <Modal
          isOpen={showRemoveConfirm}
          onClose={() => setShowRemoveConfirm(false)}
          title={t('closedClients.account.unlinkAccount')}
        >
          <div className="flex flex-col gap-4 text-start">
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-lg p-3 dark:bg-rose-950/20 dark:border-rose-900/30 text-rose-800 dark:text-rose-300">
              <AlertTriangle className="size-5 text-rose-600 shrink-0 mt-0.5 dark:text-rose-400" />
              <p className="text-sm font-medium">
                {t('closedClients.account.unlinkConfirm')}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowRemoveConfirm(false)} disabled={removing}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemove}
                disabled={removing}
              >
                {removing ? (
                  <><Loader2 className="size-4 animate-spin mr-1.5" /> {t('common.loading')}</>
                ) : (
                  <><Trash2 className="size-3.5 mr-1.5" /> {t('closedClients.account.unlinkAccount')}</>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ─── No Account View — Create Form ────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">{t('closedClients.account.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1.5">{t('closedClients.account.desc')}</p>
      </div>

      <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-4 px-6 pt-6">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserCog className="size-5 text-muted-foreground" />
            {t('closedClients.account.notLinked')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="bg-muted/40 border border-dashed border-border rounded-xl p-6 mb-6 text-center">
            <div className="size-12 rounded-full bg-primary/10 mx-auto mb-3.5 flex items-center justify-center text-[#1D61E7] dark:bg-blue-950/40">
              <UserCog className="size-6" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1.5">{t('closedClients.account.notLinked')}</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {t('closedClients.account.notLinkedDesc')}
            </p>
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-5">
            {createError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3.5 py-2.5 rounded-lg font-medium">
                {createError}
              </div>
            )}
            {createSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3.5 py-2.5 rounded-lg font-medium flex items-center gap-2 dark:bg-green-950/20 dark:border-green-900/30 dark:text-green-300">
                <CheckCircle2 className="size-4 shrink-0" />
                {createSuccess}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="create-client-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('closedClients.account.name')}
              </Label>
              <Input
                id="create-client-name"
                type="text"
                placeholder={client.name}
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                required
                className="h-10 px-3 bg-background border border-input rounded-md focus-visible:ring-2 focus-visible:ring-[#1D61E7] focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-client-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('closedClients.account.email')}
              </Label>
              <Input
                id="create-client-email"
                type="email"
                placeholder="client@example.com"
                value={createEmail}
                onChange={e => setCreateEmail(e.target.value)}
                required
                className="h-10 px-3 bg-background border border-input rounded-md focus-visible:ring-2 focus-visible:ring-[#1D61E7] focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-client-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('closedClients.account.password')}
              </Label>
              <Input
                id="create-client-password"
                type="password"
                placeholder="••••••••"
                value={createPassword}
                onChange={e => setCreatePassword(e.target.value)}
                required
                className="h-10 px-3 bg-background border border-input rounded-md focus-visible:ring-2 focus-visible:ring-[#1D61E7] focus-visible:ring-offset-2"
              />
            </div>

            <div className="flex justify-end pt-5 border-t border-border/60 mt-2">
              <Button type="submit" disabled={creating} className="gap-1.5 h-10 px-4">
                {creating ? (
                  <><Loader2 className="size-4 animate-spin" /> {t('common.loading')}</>
                ) : (
                  <><Plus className="size-4" /> {t('closedClients.account.createAccount')}</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

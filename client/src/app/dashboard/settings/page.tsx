'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { Loader2, CheckCircle2, Search, Key } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { usersApi } from '@/lib/api';
import { User } from '@/types';
import Modal from '@/components/Modal';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (user && user.role !== 'owner' && user.role !== 'team_leader') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const [agencyName, setAgencyName] = useState('Sawaqly Marketing Agency');
  const [supportEmail, setSupportEmail] = useState('support@sawaqly.com');
  const [defaultDeadlineDays, setDefaultDeadlineDays] = useState(3);
  const [backendHealth, setBackendHealth] = useState<'loading' | 'online' | 'offline'>('loading');
  const [latency, setLatency] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      const start = Date.now();
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const res = await fetch(`${apiBase}/health`);
        if (res.ok) {
          setBackendHealth('online');
          setLatency(Date.now() - start);
        } else {
          setBackendHealth('offline');
        }
      } catch {
        setBackendHealth('offline');
      }
    };
    checkHealth();
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 800);
  };

  // Tab state
  const [activeTab, setActiveTab] = useState<'agency' | 'users'>('agency');

  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit Credentials Modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'users' && user?.role === 'owner') {
      loadUsers();
    }
  }, [activeTab, user]);

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const data = await usersApi.list();
      setUsers(data.users);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!email) {
      setModalError(t('team.fieldsRequired'));
      return;
    }
    if (password && password.length < 6) {
      setModalError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    setModalError('');
    setModalSuccess('');

    try {
      await usersApi.update(selectedUser.id, { email, password: password || undefined });
      setModalSuccess(t('settings.updateSuccess'));
      setTimeout(() => {
        setIsEditOpen(false);
        setPassword('');
        setModalSuccess('');
        loadUsers();
      }, 1500);
    } catch (err: any) {
      setModalError(err.message || 'Failed to update credentials');
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (nameStr: string) => {
    return nameStr.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUsersView = () => {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 border rounded-xl bg-card">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('settings.searchUsers')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 w-full max-w-md"
            />
          </div>
          <div className="text-xs text-muted-foreground self-center">
            {t('team.showingOf', { shown: filteredUsers.length, total: users.length })}
          </div>
        </div>

        {usersLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-indigo-600" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state py-12 border rounded-xl bg-card">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">{t('team.noMembers')}</div>
          </div>
        ) : (
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base text-start">{t('settings.userAccounts')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border text-xs text-muted-foreground font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 text-start font-semibold">{t('team.name')}</th>
                      <th className="py-3 px-4 text-start font-semibold">{t('team.role')}</th>
                      <th className="py-3 px-4 text-start font-semibold">{t('settings.email')}</th>
                      <th className="py-3 px-4 text-start font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-muted/5 transition-colors">
                        <td className="py-3.5 px-4 text-start">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {getInitials(u.name)}
                            </div>
                            <span className="font-semibold text-sm text-foreground">{u.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-start">
                          <Badge
                            variant={
                              u.role === 'owner' ? 'destructive' :
                              u.role === 'team_leader' ? 'default' :
                              u.role === 'sales' ? 'secondary' :
                              u.role === 'moderation' ? 'secondary' :
                              u.role === 'account_manager' ? 'secondary' :
                              'outline'
                            }
                            className="text-[10px] py-0.5 px-1.5"
                          >
                            {u.role === 'owner' ? t('role.owner') :
                             u.role === 'team_leader' ? t('role.team_leader') :
                             u.role === 'sales' ? t('role.sales') :
                             u.role === 'moderation' ? t('role.moderation') :
                             u.role === 'account_manager' ? t('role.account_manager') :
                             t('role.member')}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-start text-muted-foreground font-medium truncate max-w-[200px]">
                          {u.email}
                        </td>
                        <td className="py-3.5 px-4 text-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setEmail(u.email);
                              setPassword('');
                              setModalError('');
                              setModalSuccess('');
                              setIsEditOpen(true);
                            }}
                            className="h-8 text-xs gap-1.5"
                          >
                            <Key className="size-3" /> {t('settings.editCredentials')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  if (user?.role !== 'owner' && user?.role !== 'team_leader') return null;

  return (
    <div className="page-container fade-in text-start">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('settings.title')}</h1>
          <p className="page-header-subtitle">{t('settings.subtitle')}</p>
        </div>
      </div>

      {/* Tabs switcher */}
      {user?.role === 'owner' && (
        <div className="flex border-b border-border mb-3 gap-6">
          <button
            onClick={() => setActiveTab('agency')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'agency'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            🏢 {t('settings.agencySettings')}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            👥 {t('settings.userAccounts')}
          </button>
        </div>
      )}

      {activeTab === 'agency' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          {/* Main Settings Panel */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base text-start">{t('settings.agencyProfile')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <form onSubmit={handleSaveSettings} className="flex flex-col gap-5">
                  {saveSuccess && (
                    <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-md text-sm font-medium">
                      <CheckCircle2 className="size-4" />
                      {t('settings.saved')}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 text-start">
                    <Label htmlFor="agency-name">{t('settings.agencyName')}</Label>
                    <Input
                      id="agency-name"
                      type="text"
                      value={agencyName}
                      onChange={e => setAgencyName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-start">
                    <Label htmlFor="support-email">{t('settings.supportEmail')}</Label>
                    <Input
                      id="support-email"
                      type="email"
                      value={supportEmail}
                      onChange={e => setSupportEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-start">
                    <Label htmlFor="deadline-days">{t('settings.defaultDeadline')}</Label>
                    <Input
                      id="deadline-days"
                      type="number"
                      min="1"
                      max="30"
                      value={defaultDeadlineDays}
                      onChange={e => setDefaultDeadlineDays(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="flex justify-end mt-1">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <><Loader2 className="size-4 animate-spin mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('settings.saving')}</>
                      ) : t('settings.saveSettings')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base text-start">{t('settings.workflowConfig')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 flex flex-col gap-5 text-start">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">{t('settings.priorities')}</h4>
                  <div className="flex flex-wrap gap-2">
                    <PriorityBadge priority="urgent" />
                    <PriorityBadge priority="high" />
                    <PriorityBadge priority="medium" />
                    <PriorityBadge priority="low" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('settings.prioritiesDesc')}
                  </p>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">{t('settings.statuses')}</h4>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status="todo" />
                    <StatusBadge status="in_progress" />
                    <StatusBadge status="submitted" />
                    <StatusBadge status="revision" />
                    <StatusBadge status="completed" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('settings.statusesDesc')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Health Sidebar */}
          <div className="text-start">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base">{t('settings.systemHealth')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{t('settings.expressServer')}</span>
                  {backendHealth === 'loading' && (
                    <Badge variant="outline" className="text-muted-foreground">{t('settings.checking')}</Badge>
                  )}
                  {backendHealth === 'online' && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <span className="size-1.5 rounded-full bg-green-500 mr-1 rtl:ml-1 rtl:mr-0" /> {t('settings.online')}
                    </Badge>
                  )}
                  {backendHealth === 'offline' && (
                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                      <span className="size-1.5 rounded-full bg-rose-500 mr-1 rtl:ml-1 rtl:mr-0" /> {t('settings.offline')}
                    </Badge>
                  )}
                </div>

                {latency !== null && backendHealth === 'online' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{t('settings.latency')}</span>
                    <span className="text-sm font-semibold">{latency}ms</span>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{t('settings.supabaseDb')}</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <span className="size-1.5 rounded-full bg-green-500 mr-1 rtl:ml-1 rtl:mr-0" /> {t('settings.connected')}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{t('settings.supabaseStorage')}</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <span className="size-1.5 rounded-full bg-green-500 mr-1 rtl:ml-1 rtl:mr-0" /> {t('settings.active')}
                  </Badge>
                </div>

                <Separator />

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('settings.healthDesc')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        renderUsersView()
      )}

      {/* EDIT CREDENTIALS MODAL */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={t('settings.editCredentials')}
      >
        {selectedUser && (
          <form onSubmit={handleUpdateCredentials} className="flex flex-col gap-4 text-start">
            {modalError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md font-medium">
                {modalError}
              </div>
            )}
            {modalSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-md font-medium">
                {modalSuccess}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('team.name')}</span>
              <span className="text-sm font-semibold text-foreground bg-muted/40 p-2 border rounded-md">{selectedUser.name}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('team.role')}</span>
              <span className="text-sm font-semibold text-foreground bg-muted/40 p-2 border rounded-md">
                {selectedUser.role === 'owner' ? t('role.owner') :
                 selectedUser.role === 'team_leader' ? t('role.team_leader') :
                 selectedUser.role === 'sales' ? t('role.sales') :
                 selectedUser.role === 'moderation' ? t('role.moderation') :
                 selectedUser.role === 'account_manager' ? t('role.account_manager') :
                 t('role.member')}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('settings.email')}
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('settings.password')}
              </Label>
              <Input
                id="edit-password"
                type="password"
                placeholder={t('settings.passwordPlaceholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={submitting}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="size-4 animate-spin mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('settings.saving')}</>
                ) : (
                  t('settings.updateCredentials')
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

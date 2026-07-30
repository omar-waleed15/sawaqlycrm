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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { Loader2, CheckCircle2, Search, Key, ShieldCheck, Lock, Mail } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { usersApi } from '@/lib/api';
import { User } from '@/types';
import Modal from '@/components/Modal';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const [agencyName, setAgencyName] = useState('Sawaqly Marketing Agency');
  const [supportEmail, setSupportEmail] = useState('support@sawaqly.com');
  const [defaultDeadlineDays, setDefaultDeadlineDays] = useState(3);
  const [backendHealth, setBackendHealth] = useState<'loading' | 'online' | 'offline'>('loading');
  const [latency, setLatency] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Profile editing state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(user?.avatar_url || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Security credentials state
  const [securityEmail, setSecurityEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState(false);
  const [securityError, setSecurityError] = useState('');

  // Sync profile state when user is loaded or modified
  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileAvatarUrl(user.avatar_url || '');
      setProfilePhone(user.phone || '');
      setSecurityEmail(user.email || '');
    }
  }, [user]);

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('File size exceeds 5MB limit.');
      return;
    }

    setUploadingAvatar(true);
    setProfileError('');
    try {
      const response = await usersApi.uploadAvatar(file);
      setProfileAvatarUrl(response.publicUrl);
      if (response.user) {
        setUser(response.user);
      } else {
        // Fallback: update profile with the new avatar URL
        const updated = await usersApi.updateProfile({ avatar_url: response.publicUrl });
        setUser(updated.user);
      }
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    setProfileError('');
    try {
      const response = await usersApi.updateProfile({ avatar_url: null });
      setProfileAvatarUrl('');
      setUser(response.user);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to remove photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setProfileError(t('team.nameRequired') || 'Name is required');
      return;
    }

    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess(false);

    try {
      const response = await usersApi.updateProfile({
        name: profileName.trim(),
        avatar_url: profileAvatarUrl || null,
        phone: profilePhone.trim() || null,
      });
      setUser(response.user);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveSecurityCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError('');
    setSecuritySuccess(false);

    const emailChanged = securityEmail.trim().toLowerCase() !== (user?.email || '').toLowerCase();
    const passwordChanged = Boolean(newPassword);

    if (!emailChanged && !passwordChanged) {
      setSecurityError(t('settings.noSecurityChanges') || 'No changes made to credentials');
      return;
    }

    if (passwordChanged) {
      if (newPassword.length < 6) {
        setSecurityError(t('settings.passwordTooShort') || 'Password must be at least 6 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        setSecurityError(t('settings.passwordsDoNotMatch') || 'New password and confirmation do not match');
        return;
      }
    }

    setSecuritySaving(true);
    try {
      const response = await usersApi.updateProfile({
        email: emailChanged ? securityEmail.trim() : undefined,
        password: passwordChanged ? newPassword : undefined,
        currentPassword: currentPassword.trim() || undefined,
      });
      setUser(response.user);
      setSecuritySuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSecuritySuccess(false), 4000);
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to update credentials');
    } finally {
      setSecuritySaving(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 800);
  };

  // Tab state (default to profile)
  const [activeTab, setActiveTab] = useState<'profile' | 'agency' | 'users'>('profile');

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
                            variant="outline"
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

  const renderProfileView = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 animate-fade-in">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base text-start">{t('settings.myProfile')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
                {profileSuccess && (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-md text-sm font-medium">
                    <CheckCircle2 className="size-4" />
                    {t('settings.profileUpdated')}
                  </div>
                )}
                {profileError && (
                  <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md font-medium">
                    {profileError}
                  </div>
                )}

                {/* Profile Photo Upload Section */}
                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl border border-dashed bg-muted/20">
                  <Avatar className="size-20 shrink-0 border shadow-sm">
                    {profileAvatarUrl && (
                      <AvatarImage src={profileAvatarUrl} alt={profileName} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-2xl font-bold">
                      {profileName ? getInitials(profileName) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex flex-col gap-2 text-center sm:text-start">
                    <Label className="text-sm font-semibold">{t('settings.profilePhoto')}</Label>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingAvatar || profileSaving}
                        className="relative h-9 text-xs font-medium"
                        onClick={() => document.getElementById('avatar-upload-input')?.click()}
                      >
                        {uploadingAvatar ? (
                          <><Loader2 className="size-3 animate-spin mr-1.5" /> {t('settings.uploading')}</>
                        ) : (
                          t('settings.uploadNew')
                        )}
                      </Button>
                      <input
                        id="avatar-upload-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                      {profileAvatarUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={uploadingAvatar || profileSaving}
                          onClick={handleRemoveAvatar}
                          className="h-9 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        >
                          {t('settings.removePhoto')}
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      PNG, JPG or JPEG. Max size 5MB.
                    </p>
                  </div>
                </div>

                {/* Name Field */}
                <div className="flex flex-col gap-1.5 text-start">
                  <Label htmlFor="profile-name">{t('settings.profileName')}</Label>
                  <Input
                    id="profile-name"
                    type="text"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    required
                    disabled={profileSaving}
                  />
                </div>
                
                {/* Phone Field */}
                <div className="flex flex-col gap-1.5 text-start font-sans">
                  <Label htmlFor="profile-phone">{t('settings.phone') || 'WhatsApp Phone Number'}</Label>
                  <Input
                    id="profile-phone"
                    type="tel"
                    placeholder="+201234567890"
                    value={profilePhone}
                    onChange={e => setProfilePhone(e.target.value)}
                    disabled={profileSaving}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Include country code (e.g. +201012345678) to receive WhatsApp notifications.
                  </p>
                </div>

                {/* Email Field (ReadOnly - managed via Security Card below) */}
                <div className="flex flex-col gap-1.5 text-start">
                  <Label htmlFor="profile-email-readonly" className="text-muted-foreground">{t('settings.emailAddress')}</Label>
                  <Input
                    id="profile-email-readonly"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted/50 cursor-not-allowed border-dashed"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t('settings.emailEditNote')}
                  </p>
                </div>

                <div className="flex justify-end mt-2">
                  <Button type="submit" disabled={profileSaving || uploadingAvatar}>
                    {profileSaving ? (
                      <><Loader2 className="size-4 animate-spin mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('settings.saving')}</>
                    ) : t('settings.saveProfile')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security & Credentials Card */}
          <Card>
            <CardHeader className="border-b flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-[#1D61E7]" />
                <CardTitle className="text-base text-start">{t('settings.security')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleSaveSecurityCredentials} className="flex flex-col gap-5">
                {securitySuccess && (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-md text-sm font-medium">
                    <CheckCircle2 className="size-4" />
                    {t('settings.credentialsUpdated')}
                  </div>
                )}
                {securityError && (
                  <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md font-medium">
                    {securityError}
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-start">
                  {t('settings.securityDesc')}
                </p>

                {/* Email Field */}
                <div className="flex flex-col gap-1.5 text-start">
                  <Label htmlFor="security-email">{t('settings.emailAddress')}</Label>
                  <Input
                    id="security-email"
                    type="email"
                    value={securityEmail}
                    onChange={e => setSecurityEmail(e.target.value)}
                    required
                    disabled={securitySaving}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t('settings.emailEditNote')}
                  </p>
                </div>

                <Separator />

                {/* Current Password Field */}
                <div className="flex flex-col gap-1.5 text-start">
                  <Label htmlFor="current-password">{t('settings.currentPassword')}</Label>
                  <Input
                    id="current-password"
                    type="password"
                    placeholder={t('settings.currentPasswordPlaceholder')}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    disabled={securitySaving}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* New Password Field */}
                  <div className="flex flex-col gap-1.5 text-start">
                    <Label htmlFor="security-new-password">{t('settings.newPassword')}</Label>
                    <Input
                      id="security-new-password"
                      type="password"
                      placeholder={t('settings.passwordPlaceholder')}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      disabled={securitySaving}
                    />
                  </div>

                  {/* Confirm Password Field */}
                  <div className="flex flex-col gap-1.5 text-start">
                    <Label htmlFor="security-confirm-password">{t('settings.confirmPassword')}</Label>
                    <Input
                      id="security-confirm-password"
                      type="password"
                      placeholder={t('settings.confirmPasswordPlaceholder')}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      disabled={securitySaving}
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-2">
                  <Button type="submit" disabled={securitySaving}>
                    {securitySaving ? (
                      <><Loader2 className="size-4 animate-spin mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('settings.saving')}</>
                    ) : t('settings.saveCredentials')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* User Info / Role Info Sidebar */}
        <div className="text-start">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">{t('settings.profile')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t('settings.role')}</span>
                <Badge
                  variant="outline"
                  className="capitalize"
                >
                  {user?.role ? t(`role.${user.role}`) : ''}
                </Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t('settings.status')}</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <span className="size-1.5 rounded-full bg-green-500 mr-1 rtl:ml-1" /> Active Account
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container fade-in text-start">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('settings.title')}</h1>
          <p className="page-header-subtitle">{t('settings.subtitle')}</p>
        </div>
      </div>

      {/* Tabs switcher */}
      {(user?.role === 'owner' || user?.role === 'team_leader') && (
        <div className="flex border-b border-border mb-4 gap-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-[#1D61E7] text-[#1D61E7] dark:border-[#1D61E7] dark:text-[#1D61E7]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            👤 {t('settings.myProfile')}
          </button>
          <button
            onClick={() => setActiveTab('agency')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'agency'
                ? 'border-[#1D61E7] text-[#1D61E7] dark:border-[#1D61E7] dark:text-[#1D61E7]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            🏢 {t('settings.agencySettings')}
          </button>
          {user?.role === 'owner' && (
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-[#1D61E7] text-[#1D61E7] dark:border-[#1D61E7] dark:text-[#1D61E7]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              👥 {t('settings.userAccounts')}
            </button>
          )}
        </div>
      )}

      {activeTab === 'profile' ? (
        renderProfileView()
      ) : activeTab === 'agency' ? (
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

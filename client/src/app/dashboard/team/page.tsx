'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { usersApi } from '@/lib/api';
import { User, UserRole } from '@/types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  Users,
  Shield,
  Target,
  BadgeDollarSign,
  UserSquare2,
  Trash2,
  Edit,
  ExternalLink,
  Loader2
} from 'lucide-react';

export default function TeamPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Redirect if not owner
    if (user && user.role !== 'owner') {
      router.replace('/dashboard');
      return;
    }

    loadUsers();
  }, [user, router]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await usersApi.list();
      setUsers(data.users);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setFormError(t('team.fieldsRequired'));
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      await usersApi.create({ name, email, password, role });
      setIsCreateOpen(false);
      resetForm();
      loadUsers();
    } catch (err: any) {
      setFormError(err.message || t('team.failedCreate'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!name) {
      setFormError(t('team.nameRequired'));
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      await usersApi.update(selectedUser.id, { name, role });
      setIsEditOpen(false);
      resetForm();
      loadUsers();
    } catch (err: any) {
      setFormError(err.message || t('team.failedUpdate'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, userName: string) => {
    if (id === user?.id) {
      alert(t('team.cannotDeleteSelf'));
      return;
    }

    if (!confirm(t('team.deleteConfirm', { name: userName }))) {
      return;
    }

    try {
      await usersApi.delete(id);
      loadUsers();
    } catch (err: any) {
      alert(err.message || t('team.failedDelete'));
    }
  };

  const openEditModal = (targetUser: User) => {
    setSelectedUser(targetUser);
    setName(targetUser.name);
    setEmail(targetUser.email);
    setRole(targetUser.role);
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('member');
    setFormError('');
    setSelectedUser(null);
  };

  const getInitials = (nameStr: string) => {
    return nameStr.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ownerCount = users.filter(u => u.role === 'owner').length;
  const memberCount = users.filter(u => u.role === 'member').length;
  const teamLeaderCount = users.filter(u => u.role === 'team_leader').length;
  const salesCount = users.filter(u => u.role === 'sales').length;

  if (user?.role !== 'owner') return null;

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('team.title')}</h1>
          <p className="page-header-subtitle">{t('team.subtitle')}</p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="gap-1.5">
          <Plus className="size-4" /> {t('team.addMember')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('team.totalTeam')}</span>
            <Users className="size-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{t('team.registeredAccounts')}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('team.admins')}</span>
            <Shield className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ownerCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{t('team.fullControl')}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('team.teamLeaders')}</span>
            <Target className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamLeaderCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{t('team.leadAssignTasks')}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('team.salesLabel')}</span>
            <BadgeDollarSign className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{t('team.clientRelations')}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('team.membersLabel')}</span>
            <UserSquare2 className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{t('team.taskExecution')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 mb-6 border rounded-xl bg-card">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('team.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 w-full max-w-md"
          />
        </div>
        <div className="text-xs text-muted-foreground self-center">
          {t('team.showingOf', { shown: filteredUsers.length, total: users.length })}
        </div>
      </div>

      {/* Team list cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
                <div className="h-px bg-muted my-4" />
                <div className="flex justify-between items-center">
                  <div className="h-3 bg-muted rounded w-1/4" />
                  <div className="h-8 bg-muted rounded w-1/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredUsers.map(member => (
            <Card key={member.id} className="hover:shadow-md transition-all duration-200">
              <CardContent className="pt-6 flex flex-col h-full gap-4">
                <div className="flex gap-4 items-center">
                  <Avatar className="size-12">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-base">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm truncate max-w-[150px]">{member.name}</h3>
                      <Badge
                        variant={
                          member.role === 'owner' ? 'destructive' :
                          member.role === 'team_leader' ? 'default' :
                          member.role === 'sales' ? 'secondary' :
                          member.role === 'moderation' ? 'secondary' :
                          member.role === 'account_manager' ? 'secondary' :
                          'outline'
                        }
                        className="text-[10px] py-0.5 px-1.5"
                      >
                        {member.role === 'owner' ? t('role.owner') :
                         member.role === 'team_leader' ? t('role.team_leader') :
                         member.role === 'sales' ? t('role.sales') :
                         member.role === 'moderation' ? t('role.moderation') :
                         member.role === 'account_manager' ? t('role.account_manager') :
                         t('role.member')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{member.email}</p>
                  </div>
                </div>

                <div className="h-px bg-border mt-2" />

                <div className="flex justify-between items-center mt-auto">
                  <span className="text-[11px] text-muted-foreground">
                    {t('team.joined')} {member.created_at ? new Date(member.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') : t('common.noData')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/dashboard/team/${member.id}`)}
                      className="h-8 text-xs gap-1"
                    >
                      <ExternalLink className="size-3" /> {t('team.tasks')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(member)}
                      className="h-8 text-xs"
                    >
                      {t('common.edit')}
                    </Button>
                    {member.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteUser(member.id, member.name)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-title">{t('team.noMembers')}</div>
          <div className="empty-state-desc">{t('team.noMembersDesc')}</div>
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t('team.addTeamMember')}
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
              {formError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-name">{t('team.fullName')}</Label>
            <Input
              id="new-name"
              type="text"
              placeholder={t('team.fullNamePlaceholder')}
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-email">{t('team.emailAddress')}</Label>
            <Input
              id="new-email"
              type="email"
              placeholder={t('team.emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">{t('team.passwordLabel')}</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-role">{t('team.roleLabel')}</Label>
            <Select value={role} onValueChange={v => setRole(v as UserRole || 'member')}>
              <SelectTrigger id="new-role">
                <SelectValue placeholder={t('team.selectRole')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{t('role.teamMember')}</SelectItem>
                <SelectItem value="team_leader">{t('role.team_leader')}</SelectItem>
                <SelectItem value="sales">{t('role.sales')}</SelectItem>
                <SelectItem value="moderation">{t('role.moderation')}</SelectItem>
                <SelectItem value="account_manager">{t('role.account_manager')}</SelectItem>
                <SelectItem value="owner">{t('role.owner')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> {t('team.creating')}
                </>
              ) : t('team.createAccount')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={t('team.editTeamMember')}
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
              {formError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-email">{t('team.emailCannotChange')}</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              disabled
              className="bg-muted cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">{t('team.fullName')}</Label>
            <Input
              id="edit-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-role">{t('team.roleLabel')}</Label>
            <Select
              value={role}
              onValueChange={v => setRole(v as UserRole || 'member')}
              disabled={selectedUser?.id === user?.id}
            >
              <SelectTrigger id="edit-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{t('role.teamMember')}</SelectItem>
                <SelectItem value="team_leader">{t('role.team_leader')}</SelectItem>
                <SelectItem value="sales">{t('role.sales')}</SelectItem>
                <SelectItem value="moderation">{t('role.moderation')}</SelectItem>
                <SelectItem value="account_manager">{t('role.account_manager')}</SelectItem>
                <SelectItem value="owner">{t('role.owner')}</SelectItem>
              </SelectContent>
            </Select>
            {selectedUser?.id === user?.id && (
              <span className="text-xs text-muted-foreground mt-0.5">{t('team.cannotDemote')}</span>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> {t('team.saving')}
                </>
              ) : t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

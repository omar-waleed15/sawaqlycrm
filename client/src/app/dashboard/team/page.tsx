'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
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
      setFormError('All fields are required');
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
      setFormError(err.message || 'Failed to create team member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!name) {
      setFormError('Name is required');
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
      setFormError(err.message || 'Failed to update team member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, userName: string) => {
    if (id === user?.id) {
      alert('You cannot delete your own account.');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${userName}? This will delete all of their profile information and accounts.`)) {
      return;
    }

    try {
      await usersApi.delete(id);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete team member');
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
          <h1 className="page-header-title">Team Management</h1>
          <p className="page-header-subtitle">Manage and assign roles to your marketing team</p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="gap-1.5">
          <Plus className="size-4" /> Add Member
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Team</span>
            <Users className="size-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Registered accounts</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">Admins</span>
            <Shield className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ownerCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Full control access</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">Team Leaders</span>
            <Target className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamLeaderCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Lead & assign tasks</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">Sales</span>
            <BadgeDollarSign className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Client relations</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">Members</span>
            <UserSquare2 className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Task execution team</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 mb-6 border rounded-xl bg-card">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search members by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 w-full max-w-md"
          />
        </div>
        <div className="text-xs text-muted-foreground self-center">
          Showing {filteredUsers.length} of {users.length} members
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
                          'outline'
                        }
                        className="text-[10px] py-0.5 px-1.5"
                      >
                        {member.role === 'owner' ? 'Admin' :
                         member.role === 'team_leader' ? 'Leader' :
                         member.role === 'sales' ? 'Sales' :
                         'Member'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{member.email}</p>
                  </div>
                </div>

                <div className="h-px bg-border mt-2" />

                <div className="flex justify-between items-center mt-auto">
                  <span className="text-[11px] text-muted-foreground">
                    Joined: {member.created_at ? new Date(member.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/dashboard/team/${member.id}`)}
                      className="h-8 text-xs gap-1"
                    >
                      <ExternalLink className="size-3" /> Tasks
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(member)}
                      className="h-8 text-xs"
                    >
                      Edit
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
          <div className="empty-state-title">No team members found</div>
          <div className="empty-state-desc">No members matched your search criteria. Try a different query.</div>
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Team Member"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
              {formError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-name">Full Name</Label>
            <Input
              id="new-name"
              type="text"
              placeholder="e.g. John Doe"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-email">Email Address</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="e.g. john@sawaqly.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">Password</Label>
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
            <Label htmlFor="new-role">Role</Label>
            <Select value={role} onValueChange={v => setRole(v as UserRole || 'member')}>
              <SelectTrigger id="new-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Team Member</SelectItem>
                <SelectItem value="team_leader">Team Leader</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="owner">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Creating...
                </>
              ) : 'Create Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Team Member"
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
              {formError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-email">Email (Cannot be changed)</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              disabled
              className="bg-muted cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <Select
              value={role}
              onValueChange={v => setRole(v as UserRole || 'member')}
              disabled={selectedUser?.id === user?.id}
            >
              <SelectTrigger id="edit-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Team Member</SelectItem>
                <SelectItem value="team_leader">Team Leader</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="owner">Admin</SelectItem>
              </SelectContent>
            </Select>
            {selectedUser?.id === user?.id && (
              <span className="text-xs text-muted-foreground mt-0.5">You cannot demote yourself.</span>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Saving...
                </>
              ) : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { usersApi, tasksApi, clientsApi } from '@/lib/api';
import { User, Task, Client } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  UserCircle,
  Clock,
  Wallet,
  CheckSquare,
  Camera,
  Loader2,
  Mail,
  Phone,
  Calendar
} from 'lucide-react';
import ProfileOverviewTab from '@/components/profile/ProfileOverviewTab';
import ProfileFinancialsTab from '@/components/profile/ProfileFinancialsTab';
import TaskCard from '@/components/TaskCard';

export default function MyProfilePage() {
  const { user, setUser } = useAuth();
  const { t, locale } = useLanguage();

  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'tasks'>('overview');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'completed'>('all');

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [tasksRes, clientsRes, profileRes] = await Promise.all([
        tasksApi.list({ assignee_id: user.id }).catch(() => ({ tasks: [] })),
        clientsApi.list().catch(() => ({ clients: [] })),
        usersApi.get(user.id).catch(() => ({ user })),
      ]);

      const userTasks = tasksRes.tasks || [];
      const allClients = clientsRes.clients || [];

      // Filter strictly to clients the user is genuinely assigned to (sales rep or assigned tasks)
      const assignedClients = allClients.filter(c => {
        if (c.sales_rep_id === user.id) return true;
        return userTasks.some(t => {
          const isAssignee = t.task_assignees?.some(a => a.user_id === user.id);
          return isAssignee && (t.client_id === c.id || t.client?.id === c.id);
        });
      });

      setTasks(userTasks);
      setClients(assignedClients);
      if (profileRes?.user) {
        setUser(profileRes.user);
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const res = await usersApi.uploadAvatar(file);
      if (res?.user) {
        setUser(res.user);
      } else if (res?.publicUrl) {
        const updated = await usersApi.updateProfile({ avatar_url: res.publicUrl });
        if (updated?.user) setUser(updated.user);
      }
    } catch (err) {
      console.error('Failed to upload avatar:', err);
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  if (!user) return null;

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const a = task.task_assignees?.find(assignee => assignee.user_id === user.id);
    const s = a ? a.status : task.status;
    if (taskFilter === 'active') return s !== 'completed';
    if (taskFilter === 'completed') return s === 'completed';
    return true;
  });

  return (
    <div className="page-container fade-in pb-16 text-start">
      {/* Profile Banner / Header */}
      <div className="relative mb-6 rounded-2xl bg-gradient-to-r from-primary/15 via-[#1D61E7]/10 to-indigo-500/10 border border-primary/20 p-6 shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10">
          <div className="relative group shrink-0">
            <Avatar className="size-20 ring-4 ring-background shadow-md overflow-hidden bg-muted">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="size-full object-cover" />
              ) : (
                <AvatarFallback className="bg-primary text-white font-black text-2xl">
                  {getInitials(user.name)}
                </AvatarFallback>
              )}
            </Avatar>

            {/* Avatar upload overlay */}
            <label className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              {uploadingAvatar ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Camera className="size-5" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-foreground tracking-tight">{user.name}</h1>
              <Badge variant="outline" className="text-xs font-bold py-0.5 px-2 bg-background/80 border-primary/30 text-primary">
                {t(`role.${user.role}`) || user.role}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap font-medium">
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" />
                {user.email}
              </span>
              {user.phone && (
                <span className="flex items-center gap-1.5 font-sans">
                  <Phone className="size-3.5 text-muted-foreground" />
                  {user.phone}
                </span>
              )}
              {user.created_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {t('profile.joinedDate')}: {new Date(user.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex border-b border-border mb-6 gap-2 sm:gap-6 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserCircle className="size-4" />
          {t('profile.overviewTab')}
        </button>

        <button
          onClick={() => setActiveTab('financials')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'financials'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wallet className="size-4" />
          {t('profile.financialsTab')}
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'tasks'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CheckSquare className="size-4" />
          {t('profile.tasksTab')} ({tasks.length})
        </button>
      </div>

      {/* Tab Content Panels */}
      {loading ? (
        <div className="py-20 text-center text-xs text-muted-foreground animate-pulse">
          {t('common.loading')}
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <ProfileOverviewTab
              member={user}
              onMemberUpdated={updated => setUser(updated)}
              canEdit={true}
              tasks={tasks}
              clients={clients}
            />
          )}

          {activeTab === 'financials' && (
            <ProfileFinancialsTab
              member={user}
              currentUser={user}
              canManage={user.role === 'owner' || user.role === 'team_leader' || user.role === 'account_manager'}
            />
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2">
                <Button
                  variant={taskFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTaskFilter('all')}
                  className="h-8 text-xs font-semibold"
                >
                  {t('common.all')} ({tasks.length})
                </Button>
                <Button
                  variant={taskFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTaskFilter('active')}
                  className="h-8 text-xs font-semibold"
                >
                  {t('profile.activeTasks')}
                </Button>
                <Button
                  variant={taskFilter === 'completed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTaskFilter('completed')}
                  className="h-8 text-xs font-semibold"
                >
                  {t('team.completedTasks')}
                </Button>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground border border-dashed rounded-2xl bg-card">
                  {t('tasks.noTasks')}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onTaskUpdated={loadData}
                      onTaskDeleted={loadData}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

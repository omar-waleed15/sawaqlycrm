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
  Loader2,
  Calendar,
  Star,
  CheckCircle2,
  XCircle,
  TrendingUp
} from 'lucide-react';

export default function TeamPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Tab control
  const [activeTab, setActiveTab] = useState<'directory' | 'performance'>('directory');

  // Performance data & filter states
  const [performanceData, setPerformanceData] = useState<import('@/types').UserPerformanceRecord[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<'this_month' | 'last_month' | 'last_30_days' | 'all_time'>('this_month');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [phone, setPhone] = useState('');
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

  const loadPerformance = async (start?: string, end?: string) => {
    try {
      setPerfLoading(true);
      const data = await usersApi.performance(start || undefined, end || undefined);
      setPerformanceData(data.performance);
    } catch (err) {
      console.error('Failed to load performance analytics:', err);
    } finally {
      setPerfLoading(false);
    }
  };

  const formatLocalYYYYMMDD = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const applyPreset = (preset: 'this_month' | 'last_month' | 'last_30_days' | 'all_time') => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatLocalYYYYMMDD(firstDay));
      setEndDate(formatLocalYYYYMMDD(now));
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatLocalYYYYMMDD(firstDay));
      setEndDate(formatLocalYYYYMMDD(lastDay));
    } else if (preset === 'last_30_days') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      setStartDate(formatLocalYYYYMMDD(start));
      setEndDate(formatLocalYYYYMMDD(now));
    } else if (preset === 'all_time') {
      setStartDate('');
      setEndDate('');
    }
  };

  useEffect(() => {
    // Initialize date filters to "This Month"
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(formatLocalYYYYMMDD(firstDay));
    setEndDate(formatLocalYYYYMMDD(now));
  }, []);

  useEffect(() => {
    if (activeTab === 'performance') {
      loadPerformance(startDate, endDate);
    }
  }, [activeTab, startDate, endDate]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setFormError(t('team.fieldsRequired'));
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      await usersApi.create({ name, email, password, role, phone: phone.trim() || null });
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
      await usersApi.update(selectedUser.id, { name, role, email, phone: phone.trim() || null });
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
    setPhone(targetUser.phone || '');
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('member');
    setPhone('');
    setFormError('');
    setSelectedUser(null);
  };

  const getInitials = (nameStr: string) => {
    return nameStr.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredTeamMembers = users.filter(u =>
    u.role !== 'client' &&
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalTeamCount = users.filter(u => u.role !== 'client').length;
  const ownerCount = users.filter(u => u.role === 'owner').length;
  const memberCount = users.filter(u => u.role === 'member').length;
  const teamLeaderCount = users.filter(u => u.role === 'team_leader').length;
  const salesCount = users.filter(u => u.role === 'sales').length;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(locale === 'ar' ? 'en-US' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDuration = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const renderPerformanceView = () => {
    const taskPerformers = performanceData.filter(p => p.user.role !== 'sales' && p.user.role !== 'client');
    const salesPerformers = performanceData.filter(p => p.user.role === 'sales');

    return (
      <div className="flex flex-col gap-6">
        {/* Controls Panel */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 border rounded-xl bg-card shadow-sm">
          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'this_month', label: t('team.thisMonth') },
              { id: 'last_30_days', label: t('team.last30Days') },
              { id: 'last_month', label: t('team.lastMonth') },
              { id: 'all_time', label: t('team.allTime') }
            ].map(p => (
              <Button
                key={p.id}
                type="button"
                variant={activePreset === p.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset(p.id as any)}
                className="h-8 text-xs transition-all duration-200 font-semibold"
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Date Inputs */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="start-date" className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                {t('team.startDate')}
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setActivePreset('' as any);
                }}
                className="h-8 text-xs py-1 px-2 w-36"
              />
            </div>
            <span className="text-muted-foreground text-xs">—</span>
            <div className="flex items-center gap-2">
              <Label htmlFor="end-date" className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                {t('team.endDate')}
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setActivePreset('' as any);
                }}
                className="h-8 text-xs py-1 px-2 w-36"
              />
            </div>
          </div>
        </div>

        {perfLoading ? (
          <div className="flex flex-col gap-6">
            <Card className="animate-pulse h-48" />
            <Card className="animate-pulse h-48" />
          </div>
        ) : performanceData.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">{t('team.noPerformanceData')}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Task Execution Table */}
            {taskPerformers.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1 text-start">
                  <Target className="size-4.5 text-[#1D61E7]" />
                  <h2 className="text-base font-bold text-foreground">{t('team.taskExecutionPerf')}</h2>
                </div>
                <div className="border border-border rounded-lg overflow-hidden bg-background shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border text-xs text-muted-foreground font-bold uppercase tracking-wider">
                          <th className="py-3 px-4 text-start font-semibold">{t('team.name')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.totalTasks')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.completedTasks')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.incompleteTasks')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.targetColumn')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.progressColumn')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.completionRate')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.avgCompletionTime')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.avgRating')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {taskPerformers.map(p => {
                          const rate = p.taskStats.completionRate;
                          const progressColor =
                            rate >= 90 ? 'bg-emerald-500' :
                            rate >= 75 ? 'bg-[#1D61E7]' :
                            rate >= 50 ? 'bg-blue-500' :
                            rate >= 30 ? 'bg-amber-500' : 'bg-rose-500';

                          return (
                            <tr key={p.user.id} className="hover:bg-muted/5 transition-colors">
                              <td className="py-3 px-4 text-start">
                                <div className="flex items-center gap-3">
                                  <Avatar className="size-8">
                                    <AvatarFallback className="bg-[#1D61E7] text-white font-bold text-xs">
                                      {getInitials(p.user.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="text-start">
                                    <div className="font-semibold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                                      {p.user.name}
                                      <Badge variant="outline" className="text-[9px] py-0 px-1 border-[#1D61E7]/25 text-[#1D61E7] bg-[#1D61E7]/5">
                                        {p.user.role === 'owner' ? t('role.owner') :
                                         p.user.role === 'team_leader' ? t('role.team_leader') :
                                         p.user.role === 'moderation' ? t('role.moderation') :
                                         p.user.role === 'account_manager' ? t('role.account_manager') :
                                         t('role.member')}
                                      </Badge>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{p.user.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-start font-semibold text-foreground tabular-nums">
                                {p.taskStats.totalTasks}
                              </td>
                              <td className="py-3 px-4 text-start text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                                {p.taskStats.completedTasks}
                              </td>
                              <td className="py-3 px-4 text-start text-muted-foreground font-semibold tabular-nums">
                                {p.taskStats.incompleteTasks}
                              </td>
                              <td className="py-3 px-4 text-start font-semibold text-foreground tabular-nums">
                                {p.taskStats.taskTarget !== null ? p.taskStats.taskTarget : (
                                  <span className="text-xs text-muted-foreground italic">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-start">
                                {p.taskStats.taskTarget !== null && p.taskStats.taskTarget > 0 ? (() => {
                                  const targetProgressRate = Math.round((p.taskStats.completedTasks / p.taskStats.taskTarget) * 100);
                                  const barColor =
                                    targetProgressRate >= 100 ? 'bg-emerald-500' :
                                    targetProgressRate >= 75 ? 'bg-[#1D61E7]' :
                                    targetProgressRate >= 40 ? 'bg-amber-500' : 'bg-rose-500';
                                  return (
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(targetProgressRate, 100)}%` }} />
                                      </div>
                                      <span className="text-xs font-bold text-foreground tabular-nums whitespace-nowrap">
                                        {p.taskStats.completedTasks}/{p.taskStats.taskTarget}
                                      </span>
                                    </div>
                                  );
                                })() : (
                                  <span className="text-xs text-muted-foreground italic">{t('taskTarget.noTarget')}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-start">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${rate}%` }} />
                                  </div>
                                  <span className="text-xs font-bold text-foreground tabular-nums">{rate}%</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-start">
                                {p.taskStats.averageCompletionTime !== null ? (
                                  <span className="text-xs font-semibold text-foreground tabular-nums">
                                    ⏱️ {formatDuration(p.taskStats.averageCompletionTime)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-start">
                                {p.taskStats.averageRating !== null ? (
                                  <div className="flex items-center gap-1">
                                    <Star className="size-3 text-amber-500 fill-amber-500 shrink-0" />
                                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tabular-nums">{p.taskStats.averageRating}</span>
                                    <span className="text-[10px] text-muted-foreground">/10</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Sales Table */}
            {salesPerformers.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1 text-start">
                  <TrendingUp className="size-4.5 text-emerald-500" />
                  <h2 className="text-base font-bold text-foreground">{t('team.salesPerf')}</h2>
                </div>
                <div className="border border-border rounded-lg overflow-hidden bg-background shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border text-xs text-muted-foreground font-bold uppercase tracking-wider">
                          <th className="py-3 px-4 text-start font-semibold">{t('team.name')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.leadsManaged')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.callsLogged')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.dealsWon')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.closedRevenue')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.targetColumn')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.progressColumn')}</th>
                          <th className="py-3 px-4 text-start font-semibold">{t('team.conversionRate')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {salesPerformers.map(p => {
                          const conversion = p.salesStats.conversionRate;
                          const barColor =
                            conversion >= 40 ? 'bg-emerald-500' :
                            conversion >= 25 ? 'bg-[#1D61E7]' :
                            conversion >= 10 ? 'bg-blue-500' :
                            conversion > 0 ? 'bg-amber-500' : 'bg-transparent';

                          return (
                            <tr key={p.user.id} className="hover:bg-muted/5 transition-colors">
                              <td className="py-3 px-4 text-start">
                                <div className="flex items-center gap-3">
                                  <Avatar className="size-8">
                                    <AvatarFallback className="bg-[#1D61E7] text-white font-bold text-xs">
                                      {getInitials(p.user.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="text-start">
                                    <div className="font-semibold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                                      {p.user.name}
                                      <Badge variant="outline" className="text-[9px] py-0 px-1 border-emerald-200 text-emerald-700 bg-emerald-50/50 dark:border-emerald-800 dark:text-emerald-300 dark:bg-emerald-950/20">
                                        {t('role.sales')}
                                      </Badge>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{p.user.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-start font-semibold text-foreground tabular-nums">
                                {p.salesStats.leadsManaged}
                              </td>
                              <td className="py-3 px-4 text-start text-muted-foreground font-semibold tabular-nums">
                                {p.salesStats.callsLogged}
                              </td>
                              <td className="py-3 px-4 text-start text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                                {p.salesStats.dealsWon}
                              </td>
                              <td className="py-3 px-4 text-start font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {formatCurrency(p.salesStats.closedRevenue)}
                              </td>
                              <td className="py-3 px-4 text-start font-semibold text-foreground tabular-nums">
                                {p.salesStats.salesTarget !== null ? (
                                  `${p.salesStats.salesTarget} ${t('sales.meetings')}`
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-start">
                                {p.salesStats.salesTarget !== null && p.salesStats.salesTarget > 0 ? (() => {
                                  const targetProgressRate = Math.round((p.salesStats.meetingsDone / p.salesStats.salesTarget) * 100);
                                  const progressColor =
                                    targetProgressRate >= 100 ? 'bg-emerald-500' :
                                    targetProgressRate >= 75 ? 'bg-[#1D61E7]' :
                                    targetProgressRate >= 40 ? 'bg-amber-500' : 'bg-rose-500';
                                  return (
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${Math.min(targetProgressRate, 100)}%` }} />
                                      </div>
                                      <span className="text-xs font-bold text-foreground tabular-nums whitespace-nowrap">
                                        {p.salesStats.meetingsDone}/{p.salesStats.salesTarget}
                                      </span>
                                    </div>
                                  );
                                })() : (
                                  <span className="text-xs text-muted-foreground italic">{t('sales.noTarget')}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-start">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${conversion}%` }} />
                                  </div>
                                  <span className="text-xs font-bold text-foreground tabular-nums">{conversion}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (user?.role !== 'owner') return null;

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('team.title')}</h1>
          <p className="page-header-subtitle">{t('team.subtitle')}</p>
        </div>
        {activeTab === 'directory' && (
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="gap-1.5">
            <Plus className="size-4" /> {t('team.addMember')}
          </Button>
        )}
      </div>

      {/* Tabs switcher */}
      <div className="flex border-b border-border mb-3 gap-6">
        <button
          onClick={() => setActiveTab('directory')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'directory'
              ? 'border-[#1D61E7] text-[#1D61E7] dark:border-[#1D61E7] dark:text-[#1D61E7]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          👥 {t('team.directory')}
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'performance'
              ? 'border-[#1D61E7] text-[#1D61E7] dark:border-[#1D61E7] dark:text-[#1D61E7]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          📈 {t('team.performance')}
        </button>
      </div>

      {activeTab === 'directory' ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('team.totalTeam')}</span>
            <Users className="size-4 text-[#1D61E7]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTeamCount}</div>
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
          {t('team.showingOf', { 
            shown: filteredTeamMembers.length, 
            total: totalTeamCount 
          })}
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
      ) : filteredTeamMembers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredTeamMembers.map(member => (
            <Card key={member.id} className="hover:shadow-md transition-all duration-200">
              <CardContent className="pt-6 flex flex-col h-full gap-4">
                <div className="flex gap-4 items-center">
                  <Avatar className="size-12">
                    <AvatarFallback className="bg-[#1D61E7] text-white font-bold text-base">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm truncate max-w-[150px]">{member.name}</h3>
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0.5 px-1.5"
                      >
                        {member.role === 'owner' ? t('role.owner') :
                         member.role === 'team_leader' ? t('role.team_leader') :
                         member.role === 'sales' ? t('role.sales') :
                         member.role === 'moderation' ? t('role.moderation') :
                         member.role === 'account_manager' ? t('role.account_manager') :
                         member.role === 'content_creator' ? (t('role.content_creator') || 'Content Creator') :
                         member.role === 'client' ? t('role.client') :
                         t('role.member')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{member.email}</p>
                    {member.phone && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">📞 {member.phone}</p>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border mt-2" />

                <div className="flex justify-between items-center mt-auto">
                  <span className="text-[11px] text-muted-foreground">
                    {t('team.joined')} {member.created_at ? new Date(member.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') : t('common.noData')}
                  </span>
                  <div className="flex items-center gap-2">
                    {member.role !== 'client' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/team/${member.id}`)}
                        className="h-8 text-xs gap-1"
                      >
                        <ExternalLink className="size-3" /> {t('team.tasks')}
                      </Button>
                    )}
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
        </>
      ) : (
        renderPerformanceView()
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
          
          <div className="flex flex-col gap-1.5 font-sans">
            <Label htmlFor="new-phone">{t('settings.phone') || 'Phone Number'}</Label>
            <Input
              id="new-phone"
              type="tel"
              placeholder="+201234567890"
              value={phone}
              onChange={e => setPhone(e.target.value)}
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
                <SelectItem value="content_creator">{t('role.content_creator') || 'Content Creator'}</SelectItem>
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
            <Label htmlFor="edit-email">{t('team.emailAddress')}</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
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

          <div className="flex flex-col gap-1.5 font-sans">
            <Label htmlFor="edit-phone">{t('settings.phone') || 'Phone Number'}</Label>
            <Input
              id="edit-phone"
              type="tel"
              placeholder="+201234567890"
              value={phone}
              onChange={e => setPhone(e.target.value)}
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
                <SelectItem value="content_creator">{t('role.content_creator') || 'Content Creator'}</SelectItem>
                <SelectItem value="owner">{t('role.owner')}</SelectItem>
                <SelectItem value="client">{t('role.client')}</SelectItem>
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

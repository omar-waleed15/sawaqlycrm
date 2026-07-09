'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { closedClientsApi, clientsApi, usersApi } from '@/lib/api';
import { Client } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import Modal from '@/components/Modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Loader2,
  Archive,
  ChevronRight,
  Phone,
  Building2,
  Calendar,
  Mail,
  MapPin,
  Check,
  MoreVertical,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';

function getCairoDateParts() {
  const options = { timeZone: 'Africa/Cairo', year: 'numeric', month: 'numeric', day: 'numeric' } as const;
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(new Date());
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    year: parseInt(partMap.year),
    month: parseInt(partMap.month),
    day: parseInt(partMap.day),
  };
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function isSetupIncomplete(client: Client): boolean {
  const hasNoTargets = (client.num_posts || 0) === 0 &&
                       (client.num_reels || 0) === 0 &&
                       (client.num_stories || 0) === 0 &&
                       (client.num_photos || 0) === 0;

  return !client.start_date || !client.address || !client.content_plan_link || hasNoTargets;
}

export default function ClosedClientsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals States
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Client Users List State
  const [clientUsers, setClientUsers] = useState<import('@/types').User[]>([]);

  // Inline account creation states
  const [createAccountInline, setCreateAccountInline] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');

  // Client Form State
  const [clientForm, setClientForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    status: 'active' as Client['status'],
    pipeline_stage: 'won' as Client['pipeline_stage'],
    start_date: '',
    address: '',
    content_plan_link: '',
    num_posts: 0,
    num_reels: 0,
    num_stories: 0,
    num_photos: 0,
    other_deliverables: '',
    deliverables_schedule: {
      posts: [] as string[],
      reels: [] as string[],
      stories: [] as string[],
      photos: [] as string[],
    },
    user_id: '',
  });

  // Memoized sets of linked and available accounts
  const linkedUserIds = useMemo(() => {
    const ids = new Set<string>();
    clients.forEach(c => {
      if (c.user_id) ids.add(c.user_id);
    });
    return ids;
  }, [clients]);

  const availableUsers = useMemo(() => {
    return clientUsers.filter(u => !linkedUserIds.has(u.id) || u.id === clientForm.user_id);
  }, [clientUsers, linkedUserIds, clientForm.user_id]);

  // Navigation Guard
  useEffect(() => {
    if (user && !['owner', 'team_leader', 'account_manager', 'moderation', 'content_creator'].includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // Load data
  useEffect(() => {
    if (user && ['owner', 'team_leader', 'account_manager', 'moderation', 'content_creator'].includes(user.role)) {
      loadClients();
    }
  }, [user]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const [closedRes, usersRes] = await Promise.all([
        closedClientsApi.list().catch(() => ({ clients: [] })),
        usersApi.list().catch(() => ({ users: [] })),
      ]);
      setClients(closedRes.clients || []);
      setClientUsers((usersRes.users || []).filter((u: any) => u.role === 'client'));
    } catch (err) {
      console.error('Failed to load closed clients and team profiles', err);
    } finally {
      setLoading(false);
    }
  };

  const resetClientForm = (client?: Client) => {
    setCreateAccountInline(false);
    setNewAccountEmail('');
    setNewAccountPassword('');
    if (client) {
      setClientForm({
        name: client.name || '',
        company: client.company || '',
        email: client.email || '',
        phone: client.phone || '',
        status: client.status || 'active',
        pipeline_stage: 'won', // Force won
        start_date: client.start_date ? client.start_date.split('T')[0] : '',
        address: client.address || '',
        content_plan_link: client.content_plan_link || '',
        num_posts: client.num_posts ?? 0,
        num_reels: client.num_reels ?? 0,
        num_stories: client.num_stories ?? 0,
        num_photos: client.num_photos ?? 0,
        other_deliverables: client.other_deliverables || '',
        deliverables_schedule: {
          posts: client.deliverables_schedule?.posts || [],
          reels: client.deliverables_schedule?.reels || [],
          stories: client.deliverables_schedule?.stories || [],
          photos: client.deliverables_schedule?.photos || [],
        },
        user_id: client.user_id || '',
      });
      setSelectedClient(client);
      setModalMode('edit');
    } else {
      const parts = getCairoDateParts();
      const todayStr = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
      setClientForm({
        name: '',
        company: '',
        email: '',
        phone: '',
        status: 'active',
        pipeline_stage: 'won', // Force won
        start_date: todayStr,
        address: '',
        content_plan_link: '',
        num_posts: 0,
        num_reels: 0,
        num_stories: 0,
        num_photos: 0,
        other_deliverables: '',
        deliverables_schedule: {
          posts: [],
          reels: [],
          stories: [],
          photos: [],
        },
        user_id: '',
      });
      setSelectedClient(null);
      setModalMode('create');
    }
    setErrorMsg('');
    setClientModalOpen(true);
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name) {
      setErrorMsg(t('team.nameRequired'));
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      if (modalMode === 'create') {
        await clientsApi.create(clientForm);
      } else if (selectedClient) {
        await clientsApi.update(selectedClient.id, clientForm);
      }
      setClientModalOpen(false);
      loadClients();
    } catch (err: any) {
      setErrorMsg(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(t('clients.deleteClientConfirm').replace('{name}', name))) return;
    try {
      await clientsApi.delete(id);
      loadClients();
    } catch (err) {
      alert('Failed to delete client');
    }
  };

  const filtered = clients.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  if (!user || !['owner', 'team_leader', 'account_manager', 'moderation', 'content_creator'].includes(user.role)) return null;

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('closedClients.title')}</h1>
          <p className="page-header-subtitle">{t('closedClients.subtitle')}</p>
        </div>
        {['owner', 'team_leader', 'account_manager'].includes(user.role) && (
          <Button onClick={() => resetClientForm()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
            <Plus className="size-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
            {t('clients.addClient')}
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4 rtl:left-auto rtl:right-3" />
        <Input
          type="text"
          placeholder={t('closedClients.searchPlaceholder')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 rtl:pl-3 rtl:pr-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed border-border bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Archive className="size-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchQuery ? `No results for "${searchQuery}"` : t('closedClients.noClients')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => (
            <Card
              key={client.id}
              className="border border-border bg-card hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200 cursor-pointer group relative"
            >
              <CardContent className="p-5 flex flex-col gap-4" onClick={() => router.push(`/dashboard/closed-clients/${client.id}`)}>
                {/* Header Row: Avatar, Name/Company & Actions */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-sm shrink-0">
                      {getInitials(client.name)}
                    </div>
                    <div className="text-start min-w-0">
                      <h3 className="text-sm font-bold text-foreground leading-snug flex items-center gap-1.5" title={client.name}>
                        <span className="truncate">{client.name}</span>
                        {isSetupIncomplete(client) && (
                          <span
                            title={t('closedClients.incompleteSetupDesc') || 'Please complete profile info, content plan, & deliverables.'}
                            onClick={(e) => {
                              e.stopPropagation();
                              resetClientForm(client);
                            }}
                            className="inline-flex items-center justify-center text-amber-500 hover:text-amber-600 cursor-pointer select-none"
                          >
                            ⚠️
                          </span>
                        )}
                      </h3>
                      {client.company && (
                        <p className="text-xs text-muted-foreground truncate" title={client.company}>
                          {client.company}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                      client.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {client.status === 'active' ? t('closedClients.activeStatus') : t('closedClients.inactiveStatus')}
                    </span>

                    {/* Actions Menu */}
                    {['owner', 'team_leader', 'account_manager'].includes(user.role) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 p-0 text-muted-foreground hover:text-foreground rounded-md shrink-0 hover:bg-muted"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => resetClientForm(client)}>
                            <Pencil className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0 text-muted-foreground" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                            onClick={() => handleDeleteClient(client.id, client.name)}
                          >
                            <Trash2 className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Contact Info Box */}
                <div className="bg-muted/20 border border-border/40 rounded-lg p-3 flex flex-col gap-2 text-start">
                  {client.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                      <Mail className="size-3.5 shrink-0 text-indigo-500/85" />
                      <span className="truncate" title={client.email}>{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="size-3.5 shrink-0 text-indigo-500/85" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.address && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0 text-indigo-500/85 mt-0.5" />
                      <span className="line-clamp-2 leading-tight" title={client.address}>{client.address}</span>
                    </div>
                  )}
                  {client.start_date && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="size-3.5 shrink-0 text-indigo-500/85" />
                      <span>{t('closedClients.clientSince')}: <strong className="text-foreground/90 font-semibold">{formatDate(client.start_date)}</strong></span>
                    </div>
                  )}
                </div>

                {/* Deliverables Tracker Section */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-start">
                    🎬 {t('clients.deliverables')}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 mt-1 text-start">
                    {[
                      { label: t('closedClients.plan.post'), done: client.done_posts ?? 0, total: client.num_posts ?? 0, color: 'bg-indigo-500' },
                      { label: t('closedClients.plan.reel'), done: client.done_reels ?? 0, total: client.num_reels ?? 0, color: 'bg-purple-500' },
                      { label: t('closedClients.plan.story'), done: client.done_stories ?? 0, total: client.num_stories ?? 0, color: 'bg-pink-500' },
                      { label: t('closedClients.plan.photo'), done: client.done_photos ?? 0, total: client.num_photos ?? 0, color: 'bg-emerald-500' },
                    ].map(item => {
                      const pct = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
                      const isComplete = item.total > 0 && item.done >= item.total;
                      return (
                        <div key={item.label} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/80">
                            <span className="truncate">{item.label}</span>
                            <span className={isComplete ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : "font-semibold"}>
                              {item.done}/{item.total}
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden border border-border/20">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {client.other_deliverables && (
                    <div className="flex items-center justify-between bg-muted/30 border border-border/20 rounded-md p-2 mt-2 text-start">
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{t('clients.otherDeliverables')}</div>
                        <div className="text-xs text-foreground/90 truncate max-w-[180px]" title={client.other_deliverables}>{client.other_deliverables}</div>
                      </div>
                      {client.done_other && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <Check className="size-3" /> Done
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer CTA */}
                <div className="flex items-center justify-end mt-2 pt-3 border-t border-border/60">
                  <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:gap-2 transition-all">
                    {t('closedClients.viewDetails')}
                    <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── CLIENT CREATE / EDIT MODAL ── */}
      <Modal
        isOpen={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        title={modalMode === 'create' ? t('clients.addClient') : t('clients.editClient')}
        maxWidth={640}
      >
        <form onSubmit={handleClientSubmit} className="flex flex-col gap-4 text-start">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-2.5 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c_name">{t('clients.clientName')} *</Label>
              <Input
                id="c_name"
                placeholder="e.g. John Doe"
                value={clientForm.name}
                onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c_company">{t('clients.company')}</Label>
              <Input
                id="c_company"
                placeholder="e.g. Acme Corp"
                value={clientForm.company}
                onChange={e => setClientForm({ ...clientForm, company: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c_email">{t('clients.email')}</Label>
              <Input
                id="c_email"
                type="email"
                placeholder="john@example.com"
                value={clientForm.email}
                onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c_phone">{t('clients.phone')}</Label>
              <Input
                id="c_phone"
                placeholder="e.g. +20 123..."
                value={clientForm.phone}
                onChange={e => setClientForm({ ...clientForm, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c_status">{t('clients.statusLabel')}</Label>
              <Select
                value={clientForm.status}
                onValueChange={v => setClientForm({ ...clientForm, status: v as Client['status'] })}
              >
                <SelectTrigger id="c_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">🟢 {t('clients.active')}</SelectItem>
                  <SelectItem value="inactive">🔴 {t('clients.inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c_start">{t('clients.startDate')}</Label>
              <Input
                id="c_start"
                type="date"
                value={clientForm.start_date}
                onChange={e => setClientForm({ ...clientForm, start_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_address">{t('clients.address')}</Label>
            <Input
              id="c_address"
              placeholder="e.g. 123 Main St, Cairo, Egypt"
              value={clientForm.address}
              onChange={e => setClientForm({ ...clientForm, address: e.target.value })}
            />
          </div>



          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => setClientModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

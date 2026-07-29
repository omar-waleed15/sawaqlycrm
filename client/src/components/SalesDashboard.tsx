'use client';

import { useState, useEffect, useCallback } from 'react';
import { salesApi, attachmentsApi, usersApi, projectsApi, tasksApi, contractsApi, clientsApi } from '@/lib/api';
import { SalesDashboardData, Client, SalesCallLog, User, Project, Contract, Task } from '@/types';
import Modal from '@/components/Modal';
import StageUpdateModal from '@/components/StageUpdateModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';
import { getCairoTodayString, formatCairoDate, formatCairoTime, formatCairoDateTime, formatLogDateTime, getCairoTodayPlusNDays, getCairoDateString, getCairoDateParts, toCairoISOString, getCairoDatetimeLocalString } from '@/lib/dateUtils';
import { 
  Phone, 
  Plus, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  FileText,
  Upload,
  ArrowRight,
  TrendingDown,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Target,
  Eye,
  Rocket,
  Building2,
  Clock,
  Mail,
  MapPin,
  ExternalLink
} from 'lucide-react';

function formatCurrency(amount: number, locale: string = 'en'): string {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
  return formatted.replace('US$', '$').replace('USD', '$').replace('دولار أمريكي', '$');
}



const PIPELINE_STAGE_CONFIG: Record<string, { labelKey: string; color: string; bg: string }> = {
  new_lead:          { labelKey: 'sales.newLead',       color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200' },
  contacted:         { labelKey: 'sales.contacted',      color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200' },
  no_answer:         { labelKey: 'sales.noAnswer',       color: 'text-amber-700', bg: 'bg-amber-100 border-amber-200' },
  interested:        { labelKey: 'sales.interested',     color: 'text-teal-700', bg: 'bg-teal-100 border-teal-200' },
  meeting_scheduled: { labelKey: 'sales.meetingScheduled', color: 'text-indigo-700', bg: 'bg-indigo-100 border-indigo-200' },
  meeting_done:      { labelKey: 'sales.meetingDone',    color: 'text-purple-700', bg: 'bg-purple-100 border-purple-200' },
  negotiation:       { labelKey: 'sales.negotiation',    color: 'text-orange-700', bg: 'bg-orange-100 border-orange-200' },
  won:               { labelKey: 'sales.won',            color: 'text-green-700', bg: 'bg-green-100 border-green-200' },
  lost:              { labelKey: 'sales.lost',           color: 'text-rose-700', bg: 'bg-rose-100 border-rose-200' },
};

interface SalesDashboardProps {
  salesRepId?: string;
}

export default function SalesDashboard({ salesRepId }: SalesDashboardProps = {}) {
  const { t, locale } = useLanguage();
  const [data, setData] = useState<SalesDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLeads, setExpandedLeads] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'leads' | 'closed'>('leads');

  // Prospect detail modal state
  const [detailDeal, setDetailDeal] = useState<Client | null>(null);
  const [dealContracts, setDealContracts] = useState<Contract[]>([]);
  const [dealProjects, setDealProjects] = useState<Project[]>([]);
  const [loadingDealData, setLoadingDealData] = useState(false);

  // Push task from won deal state
  const [pushTaskDeal, setPushTaskDeal] = useState<Client | null>(null);
  const [pushTaskForm, setPushTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    content_type: '',
    content_description: '',
    drive_link: '',
    project_id: '',
    assignee_ids: [] as string[],
  });
  const [pushingTask, setPushingTask] = useState(false);
  const [pushTaskError, setPushTaskError] = useState('');
  const [pushTaskSuccess, setPushTaskSuccess] = useState(false);

  // Modals state
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [closeWonModalOpen, setCloseWonModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Forms state: list of dynamic lead rows (starts with 1)
  const [leadRows, setLeadRows] = useState<{ name: string; phone: string; company: string; address: string; pipeline_stage: string }[]>([
    { name: '', phone: '', company: '', address: '', pipeline_stage: 'new_lead' }
  ]);

  const [selectedLead, setSelectedLead] = useState<Client | null>(null);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [stageModalTarget, setStageModalTarget] = useState<{ client: Client; stage: string } | null>(null);

  // Close Won Wizard State
  const [closeWonStep, setCloseWonStep] = useState(1);
  const [closeWonForm, setCloseWonForm] = useState({
    contractName: '',
    amount: '',
    is_recurring: true,
    billing_cycle: 'monthly',
    start_date: getCairoTodayString(),
    renewal_date: '',
    taskTitle: 'Kickoff Content Reel',
    taskDescription: '',
    taskPriority: 'medium',
    taskDueDate: '',
    taskContentType: 'reel',
    taskContentDescription: '',
    taskDriveLink: '',
    taskProjectId: '',
    taskAssigneeIds: [] as string[],
  });


  const [members, setMembers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Target quota configuration states
  const [salesTarget, setSalesTarget] = useState<number | ''>('');
  const [targetMonth, setTargetMonth] = useState<string>(() => {
    const parts = getCairoDateParts();
    return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
  });
  const [fetchingTarget, setFetchingTarget] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [targetMessage, setTargetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTarget = useCallback(async (mId: string, month: string) => {
    setFetchingTarget(true);
    try {
      const res = await salesApi.getTarget(mId, month);
      if (res.target) {
        setSalesTarget(res.target.target_amount);
      } else {
        setSalesTarget('');
      }
    } catch (err) {
      console.error('Failed to fetch sales target:', err);
    } finally {
      setFetchingTarget(false);
    }
  }, []);

  const handleSaveTarget = async () => {
    if (!salesRepId) return;
    setSavingTarget(true);
    setTargetMessage(null);
    try {
      const amount = salesTarget === '' ? 0 : Number(salesTarget);
      await salesApi.setTarget(salesRepId, targetMonth, amount);
      setTargetMessage({ type: 'success', text: 'Target updated successfully!' });
      setTimeout(() => setTargetMessage(null), 3000);
      fetchDashboard(true);
    } catch (err: any) {
      setTargetMessage({ type: 'error', text: err.message || 'Failed to update target' });
    } finally {
      setSavingTarget(false);
    }
  };

  useEffect(() => {
    if (salesRepId) {
      fetchTarget(salesRepId, targetMonth);
    }
  }, [salesRepId, targetMonth, fetchTarget]);

  const removeAssignee = (uid: string) => {
    setCloseWonForm(p => ({
      ...p,
      taskAssigneeIds: p.taskAssigneeIds.filter(id => id !== uid)
    }));
  };

  const getInitials = (nameStr: string) =>
    nameStr.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const unassignedMembers = members.filter(m => !closeWonForm.taskAssigneeIds.includes(m.id));

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await salesApi.getDashboard(salesRepId);
      setData(res);
    } catch (err) {
      console.error('Failed to load sales dashboard:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [salesRepId]);

  useEffect(() => {
    fetchDashboard();
    
    usersApi.list()
      .then(res => setMembers(res.users || []))
      .catch(err => console.error('Failed to load team members:', err));
      
    projectsApi.list()
      .then(res => setProjects(res.projects || []))
      .catch(err => console.error('Failed to load projects:', err));
  }, [fetchDashboard]);

  // Open prospect detail modal and fetch associated contracts/projects
  const openDealDetail = useCallback(async (deal: Client) => {
    setDetailDeal(deal);
    setLoadingDealData(true);
    try {
      const [contractsRes, projectsRes] = await Promise.all([
        contractsApi.list().catch(() => ({ contracts: [] })),
        projectsApi.list().catch(() => ({ projects: [] })),
      ]);
      setDealContracts((contractsRes.contracts || []).filter((c: Contract) => c.client_id === deal.id));
      setDealProjects((projectsRes.projects || []).filter((p: Project) => p.client_id === deal.id));
    } catch {
      setDealContracts([]);
      setDealProjects([]);
    } finally {
      setLoadingDealData(false);
    }
  }, []);

  const closeDealDetail = () => {
    setDetailDeal(null);
    setDealContracts([]);
    setDealProjects([]);
  };

  // Open Push Task modal from a won deal
  const openPushTaskForDeal = (deal: Client) => {
    closeDealDetail();
    setPushTaskDeal(deal);
    setPushTaskForm({
      title: '',
      description: '',
      priority: 'medium',
      due_date: getCairoTodayPlusNDays(7),
      content_type: '',
      content_description: '',
      drive_link: '',
      project_id: dealProjects.length > 0 ? dealProjects[0].id : '',
      assignee_ids: [],
    });
    setPushTaskError('');
    setPushTaskSuccess(false);
  };

  const closePushTask = () => {
    setPushTaskDeal(null);
    setPushTaskError('');
    setPushTaskSuccess(false);
  };

  const handlePushTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTaskDeal) return;
    if (!pushTaskForm.title.trim()) { setPushTaskError('Task title is required'); return; }
    if (pushTaskForm.assignee_ids.length === 0) { setPushTaskError('Please assign at least one member'); return; }
    if (!pushTaskForm.due_date) { setPushTaskError('Please set a deadline'); return; }
    if (pushTaskForm.due_date < getCairoTodayString()) {
      setPushTaskError(locale === 'ar' ? 'تاريخ التسليم لا يمكن أن يكون قبل تاريخ الإنشاء' : 'Due date cannot be earlier than task creation date');
      return;
    }

    setPushingTask(true);
    setPushTaskError('');
    try {
      await tasksApi.create({
        title: pushTaskForm.title,
        description: pushTaskForm.description || undefined,
        priority: pushTaskForm.priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: pushTaskForm.due_date,
        content_type: pushTaskForm.content_type || undefined,
        content_description: pushTaskForm.content_description || undefined,
        drive_link: pushTaskForm.drive_link || undefined,
        project_id: (pushTaskForm.project_id && pushTaskForm.project_id !== 'none') ? pushTaskForm.project_id : undefined,
        client_id: pushTaskDeal.id,
        assignee_ids: pushTaskForm.assignee_ids,
      });
      setPushTaskSuccess(true);
    } catch (err: any) {
      setPushTaskError(err.message || 'Failed to create task');
    } finally {
      setPushingTask(false);
    }
  };

  const [deletingDeal, setDeletingDeal] = useState(false);

  const handleDeleteDeal = async (dealId: string, dealName: string) => {
    if (!confirm(`Are you sure you want to delete prospect "${dealName}"? This will delete all their call logs and associated projects/contracts.`)) return;
    setDeletingDeal(true);
    try {
      await clientsApi.delete(dealId);
      closeDealDetail();
      fetchDashboard(true);
    } catch (err: any) {
      alert(err.message || 'Failed to delete prospect');
    } finally {
      setDeletingDeal(false);
    }
  };

  const toggleLeadExpanded = (leadId: string) => {
    setExpandedLeads(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleOpenAddLead = () => {
    setLeadRows([{ name: '', phone: '', company: '', address: '', pipeline_stage: 'new_lead' }]);
    setErrorMsg('');
    setLeadModalOpen(true);
  };

  const handleAddLeadRow = () => {
    setLeadRows(prev => [...prev, { name: '', phone: '', company: '', address: '', pipeline_stage: 'new_lead' }]);
  };

  const handleRemoveLeadRow = (index: number) => {
    if (leadRows.length === 1) return; // Keep at least one row
    setLeadRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleLeadRowChange = (index: number, field: string, value: string) => {
    setLeadRows(prev => prev.map((row, idx) => {
      if (idx === index) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    // Filter out rows that are completely empty to be lenient
    const activeRows = leadRows.filter(row => row.name.trim() || row.phone.trim() || row.company.trim() || row.address.trim());
    
    // If all are empty, default to the first row (which will fail validation if incomplete)
    const rowsToValidate = activeRows.length > 0 ? activeRows : leadRows;

    // Validate Name and Phone for each row
    for (let i = 0; i < rowsToValidate.length; i++) {
      const row = rowsToValidate[i];
      if (!row.name || !row.phone) {
        setErrorMsg(`Prospect #${i + 1} is incomplete. Name and Phone Number are required.`);
        setSubmitting(false);
        return;
      }
    }

    try {
      await salesApi.createLead(rowsToValidate);
      setLeadModalOpen(false);
      setLeadRows([{ name: '', phone: '', company: '', address: '', pipeline_stage: 'new_lead' }]);
      fetchDashboard(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add prospective deal(s)');
    } finally {
      setSubmitting(false);
    }
  };


  const handleCloseWonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    if (closeWonForm.amount && Number(closeWonForm.amount) <= 0) {
      setErrorMsg('Valid contract amount is required');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload: any = closeWonForm.amount ? {
        name: closeWonForm.contractName || `${selectedLead.company || selectedLead.name} - Contract`,
        amount: Number(closeWonForm.amount),
        is_recurring: closeWonForm.is_recurring,
        billing_cycle: closeWonForm.billing_cycle,
        start_date: closeWonForm.start_date,
        renewal_date: closeWonForm.is_recurring ? closeWonForm.renewal_date || undefined : undefined,
      } : undefined;

      await salesApi.closeWon(selectedLead.id, payload);

      setCloseWonModalOpen(false);
      setSelectedLead(null);
      fetchDashboard(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete won deal flow');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipCloseWon = async () => {
    if (!selectedLead) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await salesApi.closeWon(selectedLead.id);
      setCloseWonModalOpen(false);
      setSelectedLead(null);
      fetchDashboard(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete won deal flow');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="size-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  // Dashboard Stats Calculations
  const targetAmount = data?.target?.target_amount || 0;
  const currentRevenue = data?.achievements?.collectedRevenue || 0;
  const currentMeetingsDone = data?.achievements?.totalMeetingsDone || 0;
  const achievementRate = targetAmount > 0 ? Math.round((currentMeetingsDone / targetAmount) * 100) : 0;
  
  // Performance Analysis insights
  const salesAnalysis = () => {
    if (targetAmount === 0) return { text: t('sales.noTarget'), type: 'info' };
    if (achievementRate >= 100) return { text: t('sales.surpassed'), type: 'success' };
    if (achievementRate >= 75) return { text: t('sales.excellent'), type: 'success' };
    if (achievementRate >= 40) return { text: t('sales.steady'), type: 'warning' };
    return { text: t('sales.increase'), type: 'danger' };
  };
  const analysis = salesAnalysis();

  return (
    <div className="space-y-6">
      {/* ── KPI Overview Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Personal Target */}
        <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('sales.monthlyMeetingsProgress')}</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-foreground">{achievementRate}%</div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div 
                className="h-full rounded-full bg-indigo-600" 
                style={{ width: `${Math.min(achievementRate, 100)}%` }} 
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-semibold">
              {currentMeetingsDone} / {targetAmount} {t('sales.meetings')}
            </p>
          </CardContent>
        </Card>

        {/* Collected Sales Revenue */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('sales.personalClosedRevenue')}</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-foreground">
              {formatCurrency(currentRevenue, locale)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
              {t('sales.attributedDeals')}
            </p>
          </CardContent>
        </Card>

        {/* Meetings Completed */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('sales.meetingsCompleted')}</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-foreground">
              {data?.achievements?.totalMeetingsDone || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
              {t('sales.leadsCompletedMeetings')}
            </p>
          </CardContent>
        </Card>

        {/* Deals Won Count */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('sales.closedDealsWon')}</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-foreground">
              {data?.achievements?.totalDealsWon || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
              {t('sales.accountsWon')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Quota Goal / Target Setup Card ─────────────────────────────────────── */}
      {salesRepId ? (
        <Card className="border-border/80 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
            <div>
              <h3 className="text-sm font-bold tracking-tight">{t('sales.performanceTarget')}</h3>
              <p className="text-[11px] text-muted-foreground">{t('sales.configureTarget')}</p>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-5 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-end gap-4 max-w-2xl">
              <div className="flex-1 w-full space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('sales.targetMonth')}</label>
                <Input
                  type="month"
                  value={targetMonth}
                  onChange={e => setTargetMonth(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="flex-1 w-full space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('sales.targetMeetings')}</label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g. 15"
                    value={salesTarget}
                    onChange={e => setSalesTarget(e.target.value === '' ? '' : Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div className="shrink-0 w-full sm:w-auto">
                <Button
                  onClick={handleSaveTarget}
                  disabled={savingTarget || fetchingTarget}
                  className="w-full sm:w-auto h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  {savingTarget ? (
                    <span className="flex items-center gap-1.5 justify-center">
                      <Loader2 className="size-3 animate-spin" /> {t('sales.saving')}
                    </span>
                  ) : t('sales.updateTarget')}
                </Button>
              </div>
            </div>

            {fetchingTarget && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 animate-pulse">
                <Loader2 className="size-3 animate-spin text-indigo-500" /> {t('sales.loadingQuota')}
              </div>
            )}

            {targetMessage && (
              <div className={`mt-3 text-xs p-2.5 rounded-lg border ${
                targetMessage.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400' 
                  : 'bg-rose-50 border-rose-100 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400'
              }`}>
                {targetMessage.text === 'Target updated successfully!' ? t('sales.targetUpdated') : targetMessage.text}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border bg-indigo-50/15 dark:bg-indigo-950/5 relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-15px] opacity-[0.05] text-[90px] select-none pointer-events-none">💡</div>
          <CardContent className="pt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${
                analysis.type === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-950/20' : 
                analysis.type === 'warning' ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
              }`}>
                <Sparkles className="size-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('sales.targetIntelligence')}</h4>
                <p className="text-xs font-semibold mt-0.5 leading-relaxed">{analysis.text}</p>
              </div>
            </div>
            {!salesRepId && (
              <Button onClick={handleOpenAddLead} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shrink-0">
                <Plus className="size-4" /> {t('sales.uploadDeal')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tabs & Lead Management Lists ──────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
              activeTab === 'leads' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('sales.phoneList')} ({data?.phoneList?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
              activeTab === 'closed' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('sales.history')} ({data?.historicalDeals?.length || 0})
          </button>
        </div>

        {activeTab === 'leads' ? (
          /* ACTIVE PHONE LIST VIEW */
          data?.phoneList && data.phoneList.length > 0 ? (
            <div className="flex flex-col gap-3">
              {data.phoneList.map(lead => {
                const isExpanded = expandedLeads.includes(lead.id);
                const leadLogs = data.callLogs.filter(log => log.client_id === lead.id);
                const stageCfg = PIPELINE_STAGE_CONFIG[lead.pipeline_stage] || PIPELINE_STAGE_CONFIG.new_lead;

                return (
                  <Card key={lead.id} className="overflow-hidden border border-border shadow-sm bg-card">
                    <div 
                      className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-muted/10 transition-all duration-200 group"
                      onClick={() => openDealDetail(lead)}
                    >
                      {/* Left: contact detail */}
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground truncate max-w-[200px] group-hover:text-primary transition-colors">{lead.name}</h3>
                          {lead.company && (
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted border px-1.5 py-0.5 rounded">
                              {lead.company}
                            </span>
                          )}
                          <Badge variant="outline" className={`text-[9px] py-0.5 font-bold uppercase ${stageCfg.bg} ${stageCfg.color}`}>
                            {t(stageCfg.labelKey)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1 font-semibold">
                            <Phone className="size-3" /> {lead.phone}
                          </span>
                          {(lead.address || lead.email) && (
                            <span className="flex items-center gap-1">
                              • <MapPin className="size-3" /> {lead.address || lead.email}
                            </span>
                          )}
                          {lead.meeting_date && (
                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded text-[10px]">
                              {t('sales.meeting')} {formatCairoDateTime(lead.meeting_date, locale, { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                        <Button 
                          onClick={(e) => { e.stopPropagation(); toggleLeadExpanded(lead.id); }} 
                          variant="ghost" 
                          size="sm"
                          className="h-8 text-xs font-semibold gap-1"
                        >
                          {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          {t('sales.logs')} ({leadLogs.length})
                        </Button>

                        <Button
                          onClick={(e) => { e.stopPropagation(); handleDeleteDeal(lead.id, lead.name); }}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title={locale === 'ar' ? 'حذف العميل المحتمل' : 'Delete Prospect'}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expandable comments timeline */}
                    {isExpanded && (
                      <div className="bg-muted/30 border-t p-4 space-y-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {t('sales.callLogs')}
                        </h4>
                        
                        {leadLogs.length > 0 ? (
                           <div className="relative border-l border-border/80 pl-4 ml-2 space-y-4">
                            {leadLogs.map(log => {
                              const outcomeCfg = PIPELINE_STAGE_CONFIG[log.outcome] || PIPELINE_STAGE_CONFIG.new_lead;
                              return (
                                <div key={log.id} className="relative group">
                                  {/* Timeline dot */}
                                  <div className="absolute left-[-21px] top-1 size-2 rounded-full border-2 border-white bg-indigo-500 shadow-sm shrink-0" />
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground flex-wrap">
                                      <span className={`capitalize ${outcomeCfg.color}`}>{t(outcomeCfg.labelKey)}</span>
                                      <span>
                                        {formatLogDateTime(log.call_date, locale)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                                      {log.notes || <span className="italic text-muted-foreground/60">{t('sales.noComments')}</span>}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground/50 italic py-2 pl-2">
                            {t('sales.noCallLogs')}
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed py-14 text-center">
              <CardContent className="flex flex-col items-center">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3"><Phone className="size-6" /></div>
                <h3 className="font-semibold text-base mb-1">{t('sales.emptyPhoneList')}</h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  {t('sales.addProspects')}
                </p>
                {!salesRepId && (
                  <Button onClick={handleOpenAddLead} size="sm">
                    {t('sales.addDeal')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        ) : (
          /* CLOSED / HISTORICAL DEALS VIEW */
          data?.historicalDeals && data.historicalDeals.length > 0 ? (
            <div className="flex flex-col gap-3">
              {data.historicalDeals.map(lead => {
                const stageCfg = PIPELINE_STAGE_CONFIG[lead.pipeline_stage] || PIPELINE_STAGE_CONFIG.won;
                const leadCallLogs = data.callLogs.filter(log => log.client_id === lead.id);

                return (
                  <Card 
                    key={lead.id} 
                    className="overflow-hidden border border-border shadow-sm bg-card cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
                    onClick={() => openDealDetail(lead)}
                  >
                    <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{lead.name}</h3>
                          {lead.company && (
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted border px-1.5 py-0.5 rounded">
                              {lead.company}
                            </span>
                          )}
                          <Badge variant="outline" className={`text-[9px] py-0.5 font-bold uppercase ${stageCfg.bg} ${stageCfg.color}`}>
                            {t(stageCfg.labelKey)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" /> {lead.phone}
                          </span>
                          {(lead.address || lead.email) && (
                            <span className="flex items-center gap-1">
                              • <MapPin className="size-3" /> {lead.address || lead.email}
                            </span>
                          )}
                          <span>
                            • {locale === 'ar' ? 'تم الإغلاق في ' : 'Closed on '}{formatCairoDate(lead.created_at, locale, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {leadCallLogs.length > 0 && (
                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                              <Clock className="size-3" /> {leadCallLogs.length} {t('sales.logs')}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`text-xs py-1 px-3 ${lead.pipeline_stage === 'won' ? 'bg-green-50 text-green-700 font-extrabold border-green-200' : 'bg-rose-50 text-rose-700 font-extrabold border-rose-200'}`}>
                          {lead.pipeline_stage === 'won' ? `✅ ${t('sales.won')}` : `❌ ${t('sales.lost')}`}
                        </Badge>
                        <Button
                          onClick={(e) => { e.stopPropagation(); handleDeleteDeal(lead.id, lead.name); }}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title={locale === 'ar' ? 'حذف الصفقة' : 'Delete Deal'}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                        <div className="size-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <Eye className="size-4" />
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed py-14 text-center">
              <CardContent className="flex flex-col items-center">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3"><CheckCircle2 className="size-6" /></div>
                <h3 className="font-semibold text-base mb-1">{t('sales.noHistoricalDeals')}</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {t('sales.noHistoricalDealsDesc')}
                </p>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* ── Modal: Add Prospective Lead ─────────────────────────────────────── */}
      <Modal isOpen={leadModalOpen} onClose={() => setLeadModalOpen(false)} title={t('sales.addDeal')} maxWidth={768}>
        <form onSubmit={handleCreateLead} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
              {errorMsg}
            </div>
          )}

          {/* Scrollable Rows Container */}
          <div className="max-h-[55vh] overflow-y-auto pr-2 space-y-4 scrollbar-thin">
            {leadRows.map((row, index) => (
              <div key={index} className="p-4 rounded-xl border border-border/80 bg-muted/20 relative space-y-3">
                {/* Row Header */}
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-border">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    {locale === 'ar' ? `عميل محتمل رقم ${index + 1}` : `Prospect #${index + 1}`}
                  </span>
                  {leadRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLeadRow(index)}
                      className="text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-1.5 rounded-lg transition-colors"
                      title="Remove this prospect"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                {/* Grid 1: Name and Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`name-${index}`} className="text-[11px] font-semibold">{t('sales.prospectName')} *</Label>
                    <Input
                      id={`name-${index}`}
                      placeholder="e.g. John Doe"
                      value={row.name}
                      onChange={e => handleLeadRowChange(index, 'name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`phone-${index}`} className="text-[11px] font-semibold">{t('sales.phoneNumber')} *</Label>
                    <Input
                      id={`phone-${index}`}
                      type="tel"
                      placeholder="e.g. +1 (555) 019-2834"
                      value={row.phone}
                      onChange={e => handleLeadRowChange(index, 'phone', e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Grid 2: Company and Address */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`company-${index}`} className="text-[11px] font-semibold">{t('sales.companyLabel')}</Label>
                    <Input
                      id={`company-${index}`}
                      placeholder="e.g. Acme Corporation"
                      value={row.company}
                      onChange={e => handleLeadRowChange(index, 'company', e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`address-${index}`} className="text-[11px] font-semibold">{t('sales.addressLabel')}</Label>
                    <Input
                      id={`address-${index}`}
                      type="text"
                      placeholder={t('sales.addressPlaceholder')}
                      value={row.address}
                      onChange={e => handleLeadRowChange(index, 'address', e.target.value)}
                    />
                  </div>
                </div>

                {/* Grid 3: Stage */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`stage-${index}`} className="text-[11px] font-semibold">{t('sales.stage')}</Label>
                  <Select 
                    value={row.pipeline_stage} 
                    onValueChange={v => handleLeadRowChange(index, 'pipeline_stage', v || 'new_lead')}
                  >
                    <SelectTrigger id={`stage-${index}`}>
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_lead">{t('sales.newLead')}</SelectItem>
                      <SelectItem value="contacted">{t('sales.contacted')}</SelectItem>
                      <SelectItem value="no_answer">{t('sales.noAnswer')}</SelectItem>
                      <SelectItem value="meeting_scheduled">{t('sales.meetingScheduled')}</SelectItem>
                      <SelectItem value="meeting_done">{t('sales.meetingDone')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between border-t pt-3 mt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddLeadRow}
              className="text-xs font-bold gap-1 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/20 text-indigo-600"
            >
              <Plus className="size-3.5" /> {t('sales.addRow')}
            </Button>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setLeadModalOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {t('sales.addProspectsBtn')} ({leadRows.length})
              </Button>
            </div>
          </div>
        </form>
      </Modal>


      {/* ── Modal: Close Won Deal (Optional Contract) ────────────────────── */}
      <Modal isOpen={closeWonModalOpen} onClose={() => setCloseWonModalOpen(false)} title={t('sales.closeWon')}>
        <form onSubmit={handleCloseWonSubmit} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
              {errorMsg}
            </div>
          )}



          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="won-contract-name">{t('sales.contractName')}</Label>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">{locale === 'ar' ? '(اختياري)' : '(Optional)'}</span>
            </div>
            <Input
              id="won-contract-name"
              placeholder="e.g. Monthly Content Marketing Contract"
              value={closeWonForm.contractName}
              onChange={e => setCloseWonForm(p => ({ ...p, contractName: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="won-amount">{t('sales.contractAmount')}</Label>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">{locale === 'ar' ? '(اختياري)' : '(Optional)'}</span>
              </div>
              <Input
                id="won-amount"
                type="number"
                min="0"
                placeholder="e.g. 5000"
                value={closeWonForm.amount}
                onChange={e => setCloseWonForm(p => ({ ...p, amount: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="won-billing">{locale === 'ar' ? 'نوع الفوترة' : 'Billing Type'}</Label>
              <Select
                value={closeWonForm.is_recurring ? 'recurring' : 'one_time'}
                onValueChange={v => setCloseWonForm(p => ({ ...p, is_recurring: v === 'recurring' }))}
              >
                <SelectTrigger id="won-billing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">{t('finance.recurring')}</SelectItem>
                  <SelectItem value="one_time">{t('finance.oneTime')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {closeWonForm.is_recurring && (
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="won-cycle">{t('sales.billingCycle')}</Label>
                <Select
                  value={closeWonForm.billing_cycle}
                  onValueChange={v => setCloseWonForm(p => ({ ...p, billing_cycle: v || 'monthly' }))}
                >
                  <SelectTrigger id="won-cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t('finance.monthly')}</SelectItem>
                    <SelectItem value="quarterly">{t('finance.quarterly')}</SelectItem>
                    <SelectItem value="yearly">{t('finance.yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="won-renewal">{t('sales.renewalDate')}</Label>
                <Input
                  id="won-renewal"
                  type="date"
                  value={closeWonForm.renewal_date}
                  onChange={e => setCloseWonForm(p => ({ ...p, renewal_date: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t mt-2">
            <Button type="button" variant="outline" onClick={handleSkipCloseWon} disabled={submitting} className="w-full sm:w-auto text-xs">
              {submitting ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
              {locale === 'ar' ? 'إغلاق الصفقة بدون عقد' : 'Close Deal without Contract'}
            </Button>
            <Button type="submit" disabled={submitting || !closeWonForm.amount} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full sm:w-auto text-xs">
              {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              {locale === 'ar' ? 'حفظ العقد وإغلاق الصفقة' : 'Save Contract & Close Deal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Prospect Detail View ─────────────────────────────────────── */}
      {/* ── Modal: Unified Lead Workspace ────────── */}
      <Modal 
        isOpen={!!detailDeal} 
        onClose={closeDealDetail} 
        title={detailDeal ? `👤 ${detailDeal.name}` : `📋 ${t('sales.prospectDetails')}`} 
        maxWidth={720}
      >
        {detailDeal && (() => {
          const leadList: Client[] = data?.phoneList || [];
          const currentLeadIndex = leadList.findIndex((l: Client) => l.id === detailDeal.id);
          const hasPrevLead = currentLeadIndex > 0;
          const hasNextLead = currentLeadIndex >= 0 && currentLeadIndex < leadList.length - 1;

          const goToPrevLead = () => {
            if (hasPrevLead) openDealDetail(leadList[currentLeadIndex - 1]);
          };
          const goToNextLead = () => {
            if (hasNextLead) openDealDetail(leadList[currentLeadIndex + 1]);
          };

          return (
            <div className="flex flex-col gap-4">
              {/* Header Navigation & Quick Actions Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b bg-muted/20 p-3 rounded-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  {currentLeadIndex >= 0 && (
                    <span className="text-[11px] font-bold text-muted-foreground bg-muted border px-2 py-0.5 rounded-md">
                      {locale === 'ar' ? `عميل ${currentLeadIndex + 1} من ${leadList.length}` : `Lead ${currentLeadIndex + 1} of ${leadList.length}`}
                    </span>
                  )}
                  {detailDeal.company && (
                    <span className="text-xs font-bold text-muted-foreground bg-muted border px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Building2 className="size-3" /> {detailDeal.company}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={goToPrevLead}
                    disabled={!hasPrevLead}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold gap-1 px-2.5"
                  >
                    <ChevronLeft className="size-3.5 rtl:rotate-180" /> {locale === 'ar' ? 'السابق' : 'Prev'}
                  </Button>
                  <Button
                    onClick={goToNextLead}
                    disabled={!hasNextLead}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold gap-1 px-2.5"
                  >
                    {locale === 'ar' ? 'التالي' : 'Next'} <ChevronRight className="size-3.5 rtl:rotate-180" />
                  </Button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              {/* Lead Info & History Timeline */}
              <div className="space-y-4">
                {/* Contact Bar & Quick Stage Switcher */}
                <div className="bg-muted/30 border rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <a
                        href={`tel:${detailDeal.phone}`}
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg transition-all"
                      >
                        <Phone className="size-3.5" /> {detailDeal.phone || '—'}
                      </a>
                      {(detailDeal.address || detailDeal.email) && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[200px]">
                          <MapPin className="size-3 shrink-0" /> {detailDeal.address || detailDeal.email}
                        </span>
                      )}
                    </div>

                    {/* Stage Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t('clients.stageCol')}:
                      </span>
                      <Select
                        value={detailDeal.pipeline_stage || 'new_lead'}
                        onValueChange={(newStage) => {
                          if (!newStage) return;
                          if (newStage === 'won') {
                            setSelectedLead(detailDeal);
                            closeDealDetail();
                            setCloseWonStep(1);
                            setCloseWonForm(prev => ({
                              ...prev,
                              contractName: `${detailDeal.company || detailDeal.name} - Contract`,
                              taskDueDate: getCairoTodayPlusNDays(7),
                            }));
                            setErrorMsg('');
                            setCloseWonModalOpen(true);
                            return;
                          }
                          setStageModalTarget({ client: detailDeal, stage: newStage });
                          setStageModalOpen(true);
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs font-bold w-[140px] bg-background border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectItem value="new_lead">{t('sales.newLead')}</SelectItem>
                          <SelectItem value="contacted">{t('sales.contacted')}</SelectItem>
                          <SelectItem value="no_answer">{t('sales.noAnswer')}</SelectItem>
                          <SelectItem value="meeting_scheduled">{t('sales.meetingScheduled')}</SelectItem>
                          <SelectItem value="meeting_done">{t('sales.meetingDone')}</SelectItem>
                          <SelectItem value="won">{t('sales.won')}</SelectItem>
                          <SelectItem value="lost">{t('sales.lost')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {detailDeal.meeting_date && (
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                      <Calendar className="size-4 shrink-0" />
                      <span>{t('sales.meeting')}: {formatCairoDateTime(detailDeal.meeting_date, locale, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  )}
                </div>

                {/* Timeline of Logs */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5 text-indigo-500" /> {t('sales.callLogs')}
                  </h4>
                  {(() => {
                    const logs = data?.callLogs.filter(log => log.client_id === detailDeal.id) || [];
                    return logs.length > 0 ? (
                      <div className="relative border-l-2 border-border/60 pl-4 ml-2 space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                        {logs.map(log => {
                          const outcomeCfg = PIPELINE_STAGE_CONFIG[log.outcome] || PIPELINE_STAGE_CONFIG.new_lead;
                          return (
                            <div key={log.id} className="relative group">
                              <div className="absolute left-[-22px] top-1.5 size-2.5 rounded-full border-2 border-white dark:border-background bg-indigo-500 shadow-xs group-hover:scale-125 transition-all" />
                              <div className="flex flex-col gap-1 bg-muted/20 border p-2.5 rounded-lg">
                                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground flex-wrap gap-1">
                                  <Badge variant="outline" className={`text-[9px] py-0 px-1.5 uppercase font-bold ${outcomeCfg.color} ${outcomeCfg.bg}`}>
                                    {t(outcomeCfg.labelKey)}
                                  </Badge>
                                  <span>
                                    {formatLogDateTime(log.call_date, locale)}
                                  </span>
                                </div>
                                {log.notes && (
                                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                                    {log.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic py-3 text-center bg-muted/20 border rounded-lg">
                        {t('sales.noCallLogs')}
                      </p>
                    );
                  })()}
                </div>

                {/* Won Projects & Push Task bar */}
                {detailDeal.pipeline_stage === 'won' && !salesRepId && (
                  <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                      🏆 {locale === 'ar' ? 'صفقة رابحة' : 'Deal Closed Won'}
                    </span>
                    <Button
                      onClick={() => openPushTaskForDeal(detailDeal)}
                      className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-8"
                      size="sm"
                    >
                      <Rocket className="size-3.5" /> {t('sales.pushNewTask')}
                    </Button>
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-between text-xs pt-3 border-t">
                <Button
                  onClick={() => handleDeleteDeal(detailDeal.id, detailDeal.name)}
                  variant="ghost"
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                  disabled={deletingDeal}
                >
                  <Trash2 className="size-3.5 mr-1" /> {t('sales.deleteProspect')}
                </Button>
                <Button
                  onClick={closeDealDetail}
                  variant="outline"
                  className="h-8 text-xs px-3"
                >
                  {t('common.close')}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Modal: Push Task for Won Deal ───────────────────────────────────── */}
      <Modal isOpen={!!pushTaskDeal} onClose={closePushTask} title={`🚀 ${t('sales.pushTask')}: ${pushTaskDeal?.name || ''}`} maxWidth={580}>
        {pushTaskDeal && (
          <div>
            {pushTaskSuccess ? (
              <div className="text-center py-8 flex flex-col items-center justify-center">
                <CheckCircle2 className="size-14 text-green-500 mb-3" />
                <h3 className="font-bold text-base mb-1">{t('ideas.taskCreated')}</h3>
                <p className="text-xs text-muted-foreground max-w-xs mb-5">
                  {t('ideas.taskCreatedDesc', { title: pushTaskDeal.company || pushTaskDeal.name })}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={closePushTask}>{t('common.close')}</Button>
                  <Button size="sm" onClick={() => { closePushTask(); }} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                    {locale === 'ar' ? 'تم' : 'Done'} <CheckCircle2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePushTask} className="flex flex-col gap-4">
                {pushTaskError && (
                  <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
                    {pushTaskError}
                  </div>
                )}

                {/* Client context banner */}
                <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 p-3 rounded-lg text-xs">
                  <div className="font-bold text-foreground">{pushTaskDeal.company || pushTaskDeal.name}</div>
                  <div className="text-muted-foreground mt-0.5">{locale === 'ar' ? 'إنشاء مهمة جديدة مرتبطة بمشروع هذا العميل.' : "Creating a new task linked to this client's project."}</div>
                </div>

                <div className="max-h-[50vh] overflow-y-auto pr-1 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="push-task-title">{t('createTask.taskTitle')} *</Label>
                    <Input
                      id="push-task-title"
                      placeholder="e.g. Design social media content batch #2"
                      value={pushTaskForm.title}
                      onChange={e => setPushTaskForm(p => ({ ...p, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="push-task-desc">{t('createTask.description')}</Label>
                    <Textarea
                      id="push-task-desc"
                      placeholder="Task instructions, requirements, or context…"
                      value={pushTaskForm.description}
                      onChange={e => setPushTaskForm(p => ({ ...p, description: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="push-task-priority">{t('createTask.priority')}</Label>
                      <Select value={pushTaskForm.priority} onValueChange={v => setPushTaskForm(p => ({ ...p, priority: v || 'medium' }))}>
                        <SelectTrigger id="push-task-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">🟢 {t('priority.low')}</SelectItem>
                          <SelectItem value="medium">🟡 {t('priority.medium')}</SelectItem>
                          <SelectItem value="high">🟠 {t('priority.high')}</SelectItem>
                          <SelectItem value="urgent">🔴 {t('priority.urgent')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="push-task-due">{t('ideas.deadline')} *</Label>
                      <Input
                        id="push-task-due"
                        type="date"
                        value={pushTaskForm.due_date}
                        min={getCairoTodayString()}
                        onChange={e => setPushTaskForm(p => ({ ...p, due_date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {/* Resource & Drive Links */}
                  <div className="border-t border-border pt-4">
                    <Label htmlFor="push-drive-link" className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                      🔗 {t('createTask.driveLink') || 'Resource & Drive Links'}
                    </Label>
                    <Textarea
                      id="push-drive-link"
                      placeholder="https://drive.google.com/..."
                      value={pushTaskForm.drive_link}
                      onChange={e => setPushTaskForm(p => ({ ...p, drive_link: e.target.value }))}
                      rows={2}
                      className="text-xs bg-background"
                    />
                  </div>

                  {/* Project & Assignees */}
                  <div className="border-t border-border pt-4 flex flex-col gap-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{locale === 'ar' ? 'المشروع والمكلفين' : 'Project & Assignees'}</h4>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="push-project-id">{t('createTask.linkToProject')}</Label>
                      <Select value={pushTaskForm.project_id || 'none'} onValueChange={v => setPushTaskForm(p => ({ ...p, project_id: v || '' }))}>
                        <SelectTrigger id="push-project-id">
                          <SelectValue placeholder={t('createTask.selectProject')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{locale === 'ar' ? 'بدون' : 'None'}</SelectItem>
                          {projects.filter(p => p.client_id === pushTaskDeal.id).map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="mb-1 block">👥 {t('createTask.assignTo')} *</Label>
                      {pushTaskForm.assignee_ids.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {pushTaskForm.assignee_ids.map(uid => {
                            const m = members.find(u => u.id === uid);
                            if (!m) return null;
                            return (
                              <Badge key={uid} variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5 text-xs font-semibold">
                                <div className="size-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                                  {getInitials(m.name)}
                                </div>
                                {m.name}
                                <button
                                  type="button"
                                  onClick={() => setPushTaskForm(p => ({ ...p, assignee_ids: p.assignee_ids.filter(id => id !== uid) }))}
                                  className="ml-1 hover:text-destructive transition-colors"
                                >
                                  <X className="size-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Select
                          value=""
                          onValueChange={val => {
                            if (val && !pushTaskForm.assignee_ids.includes(val)) {
                              setPushTaskForm(p => ({ ...p, assignee_ids: [...p.assignee_ids, val] }));
                            }
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder={t('createTask.selectMember')} />
                          </SelectTrigger>
                          <SelectContent>
                            {members.filter(m => !pushTaskForm.assignee_ids.includes(m.id)).map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} ({m.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-3 border-t mt-2">
                  <Button type="button" variant="outline" onClick={closePushTask} disabled={pushingTask}>{t('common.cancel')}</Button>
                  <Button type="submit" disabled={pushingTask} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5">
                    {pushingTask ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                    {t('createTask.createTask')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      <StageUpdateModal
        isOpen={stageModalOpen}
        onClose={() => setStageModalOpen(false)}
        client={stageModalTarget?.client || null}
        targetStage={stageModalTarget?.stage || null}
        onSuccess={() => {
          fetchDashboard(true);
          if (detailDeal && stageModalTarget?.stage) {
            setDetailDeal(prev => prev ? ({ ...prev, pipeline_stage: stageModalTarget.stage as any }) : null);
          }
        }}
      />
    </div>
  );
}

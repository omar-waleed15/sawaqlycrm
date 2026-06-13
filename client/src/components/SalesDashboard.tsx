'use client';

import { useState, useEffect, useCallback } from 'react';
import { salesApi, attachmentsApi, usersApi, projectsApi, tasksApi, contractsApi, clientsApi } from '@/lib/api';
import { SalesDashboardData, Client, SalesCallLog, User, Project, Contract, Task } from '@/types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';
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
  X,
  Trash2,
  Target,
  Eye,
  Rocket,
  Building2,
  Clock,
  Mail,
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


const OUTCOMES = [
  { value: 'contacted', labelKey: 'sales.contacted' },
  { value: 'meeting_scheduled', labelKey: 'sales.meetingScheduled' },
  { value: 'meeting_done', labelKey: 'sales.meetingDone' },
  { value: 'won', labelKey: 'sales.wonCloseDeal' },
  { value: 'lost', labelKey: 'sales.lost' },
];

const PIPELINE_STAGE_CONFIG: Record<string, { labelKey: string; color: string; bg: string }> = {
  new_lead:          { labelKey: 'sales.newLead',       color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200' },
  contacted:         { labelKey: 'sales.contacted',      color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200' },
  meeting_scheduled: { labelKey: 'sales.meetingScheduled', color: 'text-indigo-700', bg: 'bg-indigo-100 border-indigo-200' },
  meeting_done:      { labelKey: 'sales.meetingDone',    color: 'text-purple-700', bg: 'bg-purple-100 border-purple-200' },
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
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [closeWonModalOpen, setCloseWonModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Forms state: list of dynamic lead rows (starts with 1)
  const [leadRows, setLeadRows] = useState<{ name: string; phone: string; company: string; email: string; pipeline_stage: string }[]>([
    { name: '', phone: '', company: '', email: '', pipeline_stage: 'new_lead' }
  ]);

  const [selectedLead, setSelectedLead] = useState<Client | null>(null);
  const [callForm, setCallForm] = useState({
    notes: '',
    outcome: 'contacted',
    meeting_date: '',
  });

  // Close Won Wizard State
  const [closeWonStep, setCloseWonStep] = useState(1);
  const [closeWonForm, setCloseWonForm] = useState({
    contractName: '',
    amount: '',
    is_recurring: true,
    billing_cycle: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
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
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
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
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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

  // Follow-up from deal detail
  const openFollowUpFromDetail = (deal: Client) => {
    closeDealDetail();
    setSelectedLead(deal);
    setCallForm({ notes: '', outcome: 'contacted', meeting_date: '' });
    setErrorMsg('');
    setCallModalOpen(true);
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
    setLeadRows([{ name: '', phone: '', company: '', email: '', pipeline_stage: 'new_lead' }]);
    setErrorMsg('');
    setLeadModalOpen(true);
  };

  const handleAddLeadRow = () => {
    setLeadRows(prev => [...prev, { name: '', phone: '', company: '', email: '', pipeline_stage: 'new_lead' }]);
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
    const activeRows = leadRows.filter(row => row.name.trim() || row.phone.trim() || row.company.trim() || row.email.trim());
    
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
      setLeadRows([{ name: '', phone: '', company: '', email: '', pipeline_stage: 'new_lead' }]);
      fetchDashboard(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add prospective deal(s)');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenLogCall = (lead: Client) => {
    setSelectedLead(lead);
    setCallForm({ notes: '', outcome: 'contacted', meeting_date: '' });
    setErrorMsg('');
    setCallModalOpen(true);
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    if (callForm.outcome === 'meeting_scheduled' && !callForm.meeting_date) {
      setErrorMsg('Please select a date and time for the meeting');
      return;
    }

    if (callForm.outcome === 'won') {
      // Close Won scenario, close Call Modal and open Close Won wizard
      setCallModalOpen(false);
      setCloseWonStep(1);
      setCloseWonForm(prev => ({
        ...prev,
        contractName: `${selectedLead.company || selectedLead.name} - Contract`,
        taskDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }));
      setErrorMsg('');
      setCloseWonModalOpen(true);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await salesApi.logCall(selectedLead.id, callForm);
      setCallModalOpen(false);
      fetchDashboard(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to log call data');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseWonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    if (!closeWonForm.contractName || !closeWonForm.amount) {
      setErrorMsg('Contract Name and Amount are required');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      // 1. Fire close won logic to update lead and build project/contract/tasks
      const payload: any = {
        name: closeWonForm.contractName,
        amount: Number(closeWonForm.amount),
        is_recurring: closeWonForm.is_recurring,
        billing_cycle: closeWonForm.billing_cycle,
        start_date: closeWonForm.start_date,
        renewal_date: closeWonForm.is_recurring ? closeWonForm.renewal_date || undefined : undefined,
      };

      if (closeWonForm.taskTitle) {
        payload.tasks = [{
          title: closeWonForm.taskTitle,
          description: closeWonForm.taskDescription || undefined,
          priority: closeWonForm.taskPriority,
          dueDate: closeWonForm.taskDueDate || undefined,
          contentType: closeWonForm.taskContentType || undefined,
          contentDescription: closeWonForm.taskContentDescription || undefined,
          driveLink: closeWonForm.taskDriveLink || undefined,
          projectId: closeWonForm.taskProjectId === 'new' ? undefined : closeWonForm.taskProjectId || undefined,
          assigneeIds: closeWonForm.taskAssigneeIds.length > 0 ? closeWonForm.taskAssigneeIds : undefined,
        }];
      }

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
                          {lead.email && <span>• {lead.email}</span>}
                          {lead.meeting_date && (
                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded text-[10px]">
                              {t('sales.meeting')} {new Date(lead.meeting_date).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
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
                        {!salesRepId && (
                           <Button 
                             onClick={(e) => { e.stopPropagation(); handleOpenLogCall(lead); }}
                             className="h-8 text-xs font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3"
                             size="sm"
                           >
                             <Phone className="size-3.5 animate-pulse" /> {t('sales.logCallOutcome')}
                           </Button>
                         )}
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
                                        {new Date(log.call_date).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
                          {lead.email && <span>• {lead.email}</span>}
                          <span>
                            • {locale === 'ar' ? 'تم الإغلاق في ' : 'Closed on '}{new Date(lead.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

                {/* Grid 2: Company and Email */}
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
                    <Label htmlFor={`email-${index}`} className="text-[11px] font-semibold">{t('sales.emailLabel')}</Label>
                    <Input
                      id={`email-${index}`}
                      type="email"
                      placeholder="e.g. john@acme.com"
                      value={row.email}
                      onChange={e => handleLeadRowChange(index, 'email', e.target.value)}
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

      {/* ── Modal: Log Call Outcome ────────────────────────────────────────── */}
      <Modal isOpen={callModalOpen} onClose={() => setCallModalOpen(false)} title={`${t('sales.logCallOutcome')}: ${selectedLead?.name}`}>
        <form onSubmit={handleLogCall} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="call-outcome">{t('sales.logOutcome')} *</Label>
            <Select 
              value={callForm.outcome} 
              onValueChange={v => setCallForm(p => ({ ...p, outcome: v || 'contacted' }))}
            >
              <SelectTrigger id="call-outcome">
                <SelectValue placeholder={locale === 'ar' ? 'اختر النتيجة...' : 'Select outcome...'} />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {callForm.outcome === 'meeting_scheduled' && (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              <Label htmlFor="call-meeting">📅 {t('sales.meetingDateTime')} *</Label>
              <Input
                id="call-meeting"
                type="datetime-local"
                min={new Date().toISOString().substring(0, 16)}
                value={callForm.meeting_date}
                onChange={e => setCallForm(p => ({ ...p, meeting_date: e.target.value }))}
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="call-notes">{t('sales.notesComments')}</Label>
            <Textarea
              id="call-notes"
              placeholder={t('sales.notesPlaceholder')}
              value={callForm.notes}
              onChange={e => setCallForm(p => ({ ...p, notes: e.target.value }))}
              rows={4}
            />
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => setCallModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {callForm.outcome === 'won' ? t('sales.closeWon') : t('sales.logBtn')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Close Won Deal Wizard ───────────────────────────────────── */}
      <Modal isOpen={closeWonModalOpen} onClose={() => setCloseWonModalOpen(false)} title={t('sales.closeWon')}>
        <form onSubmit={handleCloseWonSubmit} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
              {errorMsg}
            </div>
          )}

          {/* Stepper Header */}
          <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase border-b pb-2">
            <span className={closeWonStep === 1 ? 'text-indigo-600' : ''}>{locale === 'ar' ? '1. تفاصيل العقد' : '1. Contract Details'}</span>
            <ArrowRight className="size-3" />
            <span className={closeWonStep === 2 ? 'text-indigo-600' : ''}>{locale === 'ar' ? '2. إعداد المهمة' : '2. Setup Task'}</span>
          </div>

          {/* STEP 1: Contract details */}
          {closeWonStep === 1 && (
            <div className="flex flex-col gap-4 py-1">
              <div className="max-h-[50vh] overflow-y-auto pr-1.5 flex flex-col gap-4 py-1">
                <div className="bg-green-50/50 border border-green-100 p-3 rounded-lg text-xs font-medium text-green-950">
                  {locale === 'ar' 
                    ? '🎉 تهانينا! لنقم بإنهاء تفاصيل العقد. سيتم تسجيل العميل في مدير العملاء تلقائياً.' 
                    : "🎉 Congratulations! Let's finalize the contract details. The client will be logged in the client manager automatically."}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="won-contract-name">{t('sales.contractName')} *</Label>
                  <Input
                    id="won-contract-name"
                    placeholder="e.g. Monthly Content Marketing Contract"
                    value={closeWonForm.contractName}
                    onChange={e => setCloseWonForm(p => ({ ...p, contractName: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="won-amount">{t('sales.contractAmount')} *</Label>
                    <Input
                      id="won-amount"
                      type="number"
                      placeholder="e.g. 5000"
                      value={closeWonForm.amount}
                      onChange={e => setCloseWonForm(p => ({ ...p, amount: e.target.value }))}
                      required
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
              </div>

              <div className="flex justify-end pt-3 border-t">
                <Button type="button" onClick={() => setCloseWonStep(2)} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  {t('sales.nextStep')} <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Kickoff Task specs */}
          {closeWonStep === 2 && (
            <div className="flex flex-col gap-4 py-1">
              <div className="max-h-[50vh] overflow-y-auto pr-1.5 flex flex-col gap-4 py-1">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="task-title">{t('sales.taskTitle')} *</Label>
                  <Input
                    id="task-title"
                    placeholder="e.g. Kickoff Content Reel"
                    value={closeWonForm.taskTitle}
                    onChange={e => setCloseWonForm(p => ({ ...p, taskTitle: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="task-description">{t('sales.taskDescription')}</Label>
                  <Textarea
                    id="task-description"
                    placeholder="Add content outline or instructions for the creative team to begin production..."
                    value={closeWonForm.taskDescription}
                    onChange={e => setCloseWonForm(p => ({ ...p, taskDescription: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="task-priority">{t('sales.taskPriority')}</Label>
                    <Select
                      value={closeWonForm.taskPriority}
                      onValueChange={v => setCloseWonForm(p => ({ ...p, taskPriority: v || 'medium' }))}
                    >
                      <SelectTrigger id="task-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{t('priority.low')}</SelectItem>
                        <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                        <SelectItem value="high">{t('priority.high')}</SelectItem>
                        <SelectItem value="urgent">{t('priority.urgent')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="task-due">{t('sales.taskDeadline')} *</Label>
                    <Input
                      id="task-due"
                      type="date"
                      value={closeWonForm.taskDueDate}
                      onChange={e => setCloseWonForm(p => ({ ...p, taskDueDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* Content Assets */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-xs font-bold mb-3 uppercase tracking-wider text-muted-foreground">{t('createTask.contentAssets')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="task-content-type">{t('createTask.contentType')}</Label>
                      <Select
                        value={closeWonForm.taskContentType}
                        onValueChange={v => setCloseWonForm(p => ({ ...p, taskContentType: v || 'other' }))}
                      >
                        <SelectTrigger id="task-content-type">
                          <SelectValue placeholder={t('createTask.selectContentType')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="post">{t('contentType.post')}</SelectItem>
                          <SelectItem value="story">{t('contentType.story')}</SelectItem>
                          <SelectItem value="reel">{t('contentType.reel')}</SelectItem>
                          <SelectItem value="photos">{t('contentType.photos')}</SelectItem>
                          <SelectItem value="other">{t('contentType.other')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="task-drive-link">{t('createTask.driveLink')}</Label>
                      <Input
                        id="task-drive-link"
                        type="url"
                        placeholder="https://drive.google.com/..."
                        value={closeWonForm.taskDriveLink}
                        onChange={e => setCloseWonForm(p => ({ ...p, taskDriveLink: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-3">
                    <Label htmlFor="task-content-desc">{t('createTask.contentDetails')}</Label>
                    <Textarea
                      id="task-content-desc"
                      placeholder={t('createTask.contentDetailsPlaceholder')}
                      value={closeWonForm.taskContentDescription}
                      onChange={e => setCloseWonForm(p => ({ ...p, taskContentDescription: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </div>

                {/* Project & Assignees */}
                <div className="border-t border-border pt-4 flex flex-col gap-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{locale === 'ar' ? 'ربط المشروع والمكلفين' : 'Project Link & Assignees'}</h4>
                  
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="task-project-id">{t('createTask.linkToProject')}</Label>
                    <Select
                      value={closeWonForm.taskProjectId || 'new'}
                      onValueChange={v => setCloseWonForm(p => ({ ...p, taskProjectId: v || 'new' }))}
                    >
                      <SelectTrigger id="task-project-id">
                        <SelectValue placeholder={t('sales.autoProject')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">{t('sales.autoProject')}</SelectItem>
                        {projects.filter(p => p.client_id === selectedLead?.id).map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="mb-1 block">{t('createTask.assignTo')}</Label>
                    {closeWonForm.taskAssigneeIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {closeWonForm.taskAssigneeIds.map(uid => {
                          const m = members.find(u => u.id === uid);
                          if (!m) return null;
                          return (
                            <Badge
                              key={uid}
                              variant="secondary"
                              className="flex items-center gap-1.5 py-1 px-2.5 text-xs font-semibold"
                            >
                              <div className="size-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                                {getInitials(m.name)}
                              </div>
                              {m.name}
                              <button
                                type="button"
                                onClick={() => removeAssignee(uid)}
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
                          if (val) {
                            setCloseWonForm(p => {
                              if (p.taskAssigneeIds.includes(val)) return p;
                              return { ...p, taskAssigneeIds: [...p.taskAssigneeIds, val] };
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={t('createTask.selectMember')} />
                        </SelectTrigger>
                        <SelectContent>
                          {unassignedMembers.map(m => (
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
                <Button type="button" variant="outline" onClick={() => setCloseWonStep(1)} disabled={submitting}>{t('common.back')}</Button>
                <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  🚀 {t('sales.completeClosing')}
                </Button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* ── Modal: Prospect Detail View ─────────────────────────────────────── */}
      <Modal isOpen={!!detailDeal} onClose={closeDealDetail} title={`📋 ${t('sales.prospectDetails')}`} maxWidth={640}>
        {detailDeal && (
          <div className="flex flex-col gap-5">
            {/* Status Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs py-1 px-3 font-bold uppercase ${
                  (PIPELINE_STAGE_CONFIG[detailDeal.pipeline_stage] || PIPELINE_STAGE_CONFIG.won).bg
                } ${
                  (PIPELINE_STAGE_CONFIG[detailDeal.pipeline_stage] || PIPELINE_STAGE_CONFIG.won).color
                }`}>
                  {t((PIPELINE_STAGE_CONFIG[detailDeal.pipeline_stage] || PIPELINE_STAGE_CONFIG.won).labelKey)}
                </Badge>
                {detailDeal.company && (
                  <span className="text-xs font-bold text-muted-foreground bg-muted border px-2 py-0.5 rounded flex items-center gap-1">
                    <Building2 className="size-3" /> {detailDeal.company}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {locale === 'ar' ? 'تمت الإضافة في ' : 'Added '}{new Date(detailDeal.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {/* Contact Info Card */}
            <div className="bg-muted/30 border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 text-sm">
                <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 shrink-0">
                  <Phone className="size-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{locale === 'ar' ? 'الهاتف' : 'Phone'}</div>
                  <a href={`tel:${detailDeal.phone}`} className="text-xs font-semibold text-foreground hover:text-indigo-600 transition-colors">
                    {detailDeal.phone || '—'}
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 shrink-0">
                  <Mail className="size-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('sales.emailLabel')}</div>
                  <span className="text-xs font-semibold text-foreground">{detailDeal.email || '—'}</span>
                </div>
              </div>
              {detailDeal.meeting_date && (
                <div className="flex items-center gap-2.5 text-sm sm:col-span-2">
                  <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 shrink-0">
                    <Calendar className="size-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{locale === 'ar' ? 'تاريخ الاجتماع' : 'Meeting Date'}</div>
                    <span className="text-xs font-semibold text-foreground">
                      {new Date(detailDeal.meeting_date).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Project & Contract Info (for won deals) */}
            {detailDeal.pipeline_stage === 'won' && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="size-3" /> {locale === 'ar' ? 'المشروع والعقد' : 'Project & Contract'}
                </h4>
                {loadingDealData ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                    <Loader2 className="size-3.5 animate-spin" /> {t('common.loading')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dealProjects.length > 0 ? dealProjects.map(proj => (
                      <div key={proj.id} className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-foreground">{proj.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {t('clients.status')}: <span className="font-semibold capitalize">{proj.status}</span>
                            {proj.budget > 0 && <> • {t('clients.budget')}: <span className="font-semibold">{formatCurrency(proj.budget, locale)}</span></>}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase bg-white dark:bg-background">
                          {locale === 'ar' ? 'مشروع' : 'Project'}
                        </Badge>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground/60 italic py-1">{t('clients.noProjects')}</p>
                    )}

                    {dealContracts.length > 0 ? dealContracts.map(contract => (
                      <div key={contract.id} className="bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/30 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-foreground">{contract.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {formatCurrency(contract.amount, locale)}
                            {contract.is_recurring && <> • <span className="capitalize">{contract.billing_cycle}</span></>}
                            {' '}• <span className="font-semibold capitalize">{contract.status}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase bg-white dark:bg-background">
                          {locale === 'ar' ? 'عقد' : 'Contract'}
                        </Badge>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground/60 italic py-1">{locale === 'ar' ? 'لا توجد عقود مرتبطة بهذا العميل.' : 'No contracts linked to this client.'}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Call Logs Timeline */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3" /> {t('sales.callLogs')}
              </h4>
              {(() => {
                const logs = data?.callLogs.filter(log => log.client_id === detailDeal.id) || [];
                return logs.length > 0 ? (
                  <div className="relative border-l-2 border-border/60 pl-4 ml-2 space-y-4 max-h-[220px] overflow-y-auto pr-1">
                    {logs.map(log => {
                      const outcomeCfg = PIPELINE_STAGE_CONFIG[log.outcome] || PIPELINE_STAGE_CONFIG.new_lead;
                      return (
                        <div key={log.id} className="relative">
                          <div className="absolute left-[-22px] top-1.5 size-2.5 rounded-full border-2 border-white dark:border-background bg-indigo-500 shadow-sm" />
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground flex-wrap gap-1">
                              <span className={`capitalize ${outcomeCfg.color}`}>{t(outcomeCfg.labelKey)}</span>
                              <span>
                                {new Date(log.call_date).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap leading-relaxed">
                              {log.notes || <span className="italic text-muted-foreground/50">{t('sales.noComments')}</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic py-2">
                    {t('sales.noCallLogs')}
                  </p>
                );
              })()}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap pt-3 border-t mt-1">
              {detailDeal.pipeline_stage === 'won' && !salesRepId && (
                <Button
                  onClick={() => openPushTaskForDeal(detailDeal)}
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
                  size="sm"
                >
                  <Rocket className="size-3.5" /> {t('sales.pushNewTask')}
                </Button>
              )}
              {!salesRepId && (
                <>
                  <Button
                    onClick={() => openFollowUpFromDetail(detailDeal)}
                    variant="outline"
                    className="gap-1.5 text-xs font-semibold"
                    size="sm"
                  >
                    <Phone className="size-3.5" /> {t('sales.followUp')}
                  </Button>
                  <Button
                    onClick={() => handleDeleteDeal(detailDeal.id, detailDeal.name)}
                    variant="destructive"
                    className="gap-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                    size="sm"
                    disabled={deletingDeal}
                  >
                    {deletingDeal ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    {t('sales.deleteProspect')}
                  </Button>
                </>
              )}
              <Button
                onClick={closeDealDetail}
                variant="ghost"
                className="ml-auto text-xs"
                size="sm"
              >
                {t('common.close')}
              </Button>
            </div>
          </div>
        )}
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
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setPushTaskForm(p => ({ ...p, due_date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {/* Content Assets */}
                  <div className="border-t border-border pt-4">
                    <h4 className="text-xs font-bold mb-3 uppercase tracking-wider text-muted-foreground">{t('createTask.contentAssets')}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="push-content-type">{t('createTask.contentType')}</Label>
                        <Select value={pushTaskForm.content_type} onValueChange={v => setPushTaskForm(p => ({ ...p, content_type: v || '' }))}>
                          <SelectTrigger id="push-content-type">
                            <SelectValue placeholder={t('createTask.selectContentType')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="post">{t('contentType.post')}</SelectItem>
                            <SelectItem value="story">{t('contentType.story')}</SelectItem>
                            <SelectItem value="reel">{t('contentType.reel')}</SelectItem>
                            <SelectItem value="photos">{t('contentType.photos')}</SelectItem>
                            <SelectItem value="other">{t('contentType.other')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="push-drive-link">{t('createTask.driveLink')}</Label>
                        <Input
                          id="push-drive-link"
                          type="url"
                          placeholder="https://drive.google.com/…"
                          value={pushTaskForm.drive_link}
                          onChange={e => setPushTaskForm(p => ({ ...p, drive_link: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 mt-3">
                      <Label htmlFor="push-content-desc">{t('createTask.contentDetails')}</Label>
                      <Textarea
                        id="push-content-desc"
                        placeholder={t('createTask.contentDetailsPlaceholder')}
                        value={pushTaskForm.content_description}
                        onChange={e => setPushTaskForm(p => ({ ...p, content_description: e.target.value }))}
                        rows={2}
                      />
                    </div>
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
    </div>
  );
}

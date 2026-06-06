'use client';

import { useState, useEffect, useCallback } from 'react';
import { salesApi, attachmentsApi, usersApi, projectsApi } from '@/lib/api';
import { SalesDashboardData, Client, SalesCallLog, User, Project } from '@/types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Trash2
} from 'lucide-react';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

const OUTCOMES = [
  { value: 'contacted', label: '📞 Contacted' },
  { value: 'meeting_scheduled', label: '📅 Meeting Scheduled' },
  { value: 'proposal_sent', label: '📄 Proposal Sent' },
  { value: 'negotiation', label: '🤝 Negotiation' },
  { value: 'won', label: '🏆 Won (Close Deal)' },
  { value: 'lost', label: '❌ Lost' },
];

const PIPELINE_STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new_lead:          { label: 'New Lead',       color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200' },
  contacted:         { label: 'Contacted',      color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200' },
  meeting_scheduled: { label: 'Meeting Scheduled', color: 'text-indigo-700', bg: 'bg-indigo-100 border-indigo-200' },
  proposal_sent:     { label: 'Proposal Sent',  color: 'text-purple-700', bg: 'bg-purple-100 border-purple-200' },
  negotiation:       { label: 'Negotiation',    color: 'text-amber-700', bg: 'bg-amber-100 border-amber-200' },
  won:               { label: 'Won',            color: 'text-green-700', bg: 'bg-green-100 border-green-200' },
  lost:              { label: 'Lost',           color: 'text-rose-700', bg: 'bg-rose-100 border-rose-200' },
};

interface SalesDashboardProps {
  salesRepId?: string;
}

export default function SalesDashboard({ salesRepId }: SalesDashboardProps = {}) {
  const [data, setData] = useState<SalesDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLeads, setExpandedLeads] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'leads' | 'closed'>('leads');

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

  const [assigneePickerId, setAssigneePickerId] = useState('');
  const [members, setMembers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const addAssignee = () => {
    if (!assigneePickerId) return;
    setCloseWonForm(p => {
      if (p.taskAssigneeIds.includes(assigneePickerId)) return p;
      return { ...p, taskAssigneeIds: [...p.taskAssigneeIds, assigneePickerId] };
    });
    setAssigneePickerId('');
  };

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
        <p className="text-sm text-muted-foreground">Loading sales intelligence dashboard...</p>
      </div>
    );
  }

  // Dashboard Stats Calculations
  const targetAmount = data?.target?.target_amount || 0;
  const currentRevenue = data?.achievements?.collectedRevenue || 0;
  const achievementRate = targetAmount > 0 ? Math.round((currentRevenue / targetAmount) * 100) : 0;
  
  // Performance Analysis insights
  const salesAnalysis = () => {
    if (targetAmount === 0) return { text: 'No sales quota target set for this month yet.', type: 'info' };
    if (achievementRate >= 100) return { text: 'Phenomenal job! You have surpassed your target quota for this month! 🏆', type: 'success' };
    if (achievementRate >= 75) return { text: 'Excellent progress! You are close to hitting your monthly goal. Just a few more calls!', type: 'success' };
    if (achievementRate >= 40) return { text: 'Steady achievements. Focus on active negotiations to close outstanding deals.', type: 'warning' };
    return { text: 'Increase call volume and follow up on pending proposals to push conversions forward.', type: 'danger' };
  };
  const analysis = salesAnalysis();

  return (
    <div className="space-y-6">
      {/* ── KPI Overview Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Personal Target */}
        <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">Monthly Target Progress</span>
            <TrendingUp className="size-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold">{achievementRate}%</div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div 
                className={`h-full rounded-full ${achievementRate >= 75 ? 'bg-green-500' : achievementRate >= 40 ? 'bg-yellow-500' : 'bg-rose-500'}`} 
                style={{ width: `${Math.min(achievementRate, 100)}%` }} 
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-semibold">
              {formatCurrency(currentRevenue)} / {formatCurrency(targetAmount)}
            </p>
          </CardContent>
        </Card>

        {/* Collected Sales Revenue */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">Personal Closed Revenue</span>
            <DollarSign className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-green-600">
              {formatCurrency(currentRevenue)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
              Attributed recurring + one-time deals
            </p>
          </CardContent>
        </Card>

        {/* Active Negotiations */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">Active Negotiations</span>
            <Phone className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-amber-600">
              {data?.achievements?.totalDealsNegotiating || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
              Warm leads in discussion
            </p>
          </CardContent>
        </Card>

        {/* Deals Won Count */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">Closed Deals Won</span>
            <CheckCircle2 className="size-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-purple-600">
              {data?.achievements?.totalDealsWon || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
              Accounts successfully won
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Quota Goal Intelligence Card ─────────────────────────────────────── */}
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
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target Intelligence</h4>
              <p className="text-xs font-semibold mt-0.5 leading-relaxed">{analysis.text}</p>
            </div>
          </div>
          {!salesRepId && (
            <Button onClick={handleOpenAddLead} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shrink-0">
              <Plus className="size-4" /> Upload Prospective Deal
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Tabs & Lead Management Lists ──────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
              activeTab === 'leads' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            📞 Phone List & Active Deals ({data?.phoneList?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
              activeTab === 'closed' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            🏆 History & Achievements ({data?.historicalDeals?.length || 0})
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
                  <Card key={lead.id} className="overflow-hidden border border-border shadow-sm">
                    <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      {/* Left: contact detail */}
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground truncate max-w-[200px]">{lead.name}</h3>
                          {lead.company && (
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted border px-1.5 py-0.5 rounded">
                              🏢 {lead.company}
                            </span>
                          )}
                          <Badge variant="outline" className={`text-[9px] py-0.5 font-bold uppercase ${stageCfg.bg} ${stageCfg.color}`}>
                            {stageCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1 font-semibold">
                            <Phone className="size-3" /> {lead.phone}
                          </span>
                          {lead.email && <span>• {lead.email}</span>}
                          {lead.meeting_date && (
                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded text-[10px]">
                              📅 Meeting: {new Date(lead.meeting_date).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                        <Button 
                          onClick={() => toggleLeadExpanded(lead.id)} 
                          variant="ghost" 
                          size="sm"
                          className="h-8 text-xs font-semibold gap-1"
                        >
                          {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          Logs ({leadLogs.length})
                        </Button>
                        {!salesRepId && (
                           <Button 
                             onClick={() => handleOpenLogCall(lead)}
                             className="h-8 text-xs font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3"
                             size="sm"
                           >
                             <Phone className="size-3.5 animate-pulse" /> Log Call / Outcome
                           </Button>
                         )}
                      </div>
                    </div>

                    {/* Expandable comments timeline */}
                    {isExpanded && (
                      <div className="bg-muted/30 border-t p-4 space-y-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Call Logs & Personal Comments
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
                                      <span className={`capitalize ${outcomeCfg.color}`}>{outcomeCfg.label}</span>
                                      <span>
                                        {new Date(log.call_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                                      {log.notes || <span className="italic text-muted-foreground/60">No comment notes logged.</span>}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground/50 italic py-2 pl-2">
                            No follow-up calls or negotiation log notes have been registered for this prospect.
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
                <div className="size-12 rounded-full bg-muted flex items-center justify-center text-xl mb-3">📞</div>
                <h3 className="font-semibold text-base mb-1">Your Phone List is Empty</h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  Upload new prospective deals and keep calling prospects to start deal negotiations.
                </p>
                {!salesRepId && (
                  <Button onClick={handleOpenAddLead} size="sm">
                    Add Prospective Lead
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
                const repContracts = data.callLogs.filter(log => log.client_id === lead.id);

                return (
                  <Card key={lead.id} className="overflow-hidden border border-border shadow-sm bg-card">
                    <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground">{lead.name}</h3>
                          {lead.company && (
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted border px-1.5 py-0.5 rounded">
                              🏢 {lead.company}
                            </span>
                          )}
                          <Badge variant="outline" className={`text-[9px] py-0.5 font-bold uppercase ${stageCfg.bg} ${stageCfg.color}`}>
                            {stageCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" /> {lead.phone}
                          </span>
                          {lead.email && <span>• {lead.email}</span>}
                          <span>
                            • Closed on {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <Badge variant="secondary" className={`text-xs py-1 px-3 ${lead.pipeline_stage === 'won' ? 'bg-green-50 text-green-700 font-extrabold border-green-200' : 'bg-rose-50 text-rose-700 font-extrabold border-rose-200'}`}>
                          {lead.pipeline_stage === 'won' ? 'Won' : 'Lost'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed py-14 text-center">
              <CardContent className="flex flex-col items-center">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center text-xl mb-3">🏆</div>
                <h3 className="font-semibold text-base mb-1">No Historical Deals</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Deals you close as Won or Lost will show up in this history sheet. Start calling to win deals!
                </p>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* ── Modal: Add Prospective Lead ─────────────────────────────────────── */}
      <Modal isOpen={leadModalOpen} onClose={() => setLeadModalOpen(false)} title="🌱 Add Prospective Deals" maxWidth={768}>
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
                    Prospect #{index + 1}
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
                    <Label htmlFor={`name-${index}`} className="text-[11px] font-semibold">Prospect Name *</Label>
                    <Input
                      id={`name-${index}`}
                      placeholder="e.g. John Doe"
                      value={row.name}
                      onChange={e => handleLeadRowChange(index, 'name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`phone-${index}`} className="text-[11px] font-semibold">Phone Number *</Label>
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
                    <Label htmlFor={`company-${index}`} className="text-[11px] font-semibold">Company Name</Label>
                    <Input
                      id={`company-${index}`}
                      placeholder="e.g. Acme Corporation"
                      value={row.company}
                      onChange={e => handleLeadRowChange(index, 'company', e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`email-${index}`} className="text-[11px] font-semibold">Email Address</Label>
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
                  <Label htmlFor={`stage-${index}`} className="text-[11px] font-semibold">Initial Status</Label>
                  <Select 
                    value={row.pipeline_stage} 
                    onValueChange={v => handleLeadRowChange(index, 'pipeline_stage', v || 'new_lead')}
                  >
                    <SelectTrigger id={`stage-${index}`}>
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_lead">🌱 New Lead (Not Called Yet)</SelectItem>
                      <SelectItem value="contacted">📞 Contacted (Called)</SelectItem>
                      <SelectItem value="negotiation">🤝 Negotiation Started</SelectItem>
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
              <Plus className="size-3.5" /> Add Another Prospect
            </Button>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setLeadModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Create Deals ({leadRows.length})
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Log Call Outcome ────────────────────────────────────────── */}
      <Modal isOpen={callModalOpen} onClose={() => setCallModalOpen(false)} title={`📞 Log Call: ${selectedLead?.name}`}>
        <form onSubmit={handleLogCall} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="call-outcome">Call Outcome / Update Status *</Label>
            <Select 
              value={callForm.outcome} 
              onValueChange={v => setCallForm(p => ({ ...p, outcome: v || 'contacted' }))}
            >
              <SelectTrigger id="call-outcome">
                <SelectValue placeholder="Select outcome..." />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {callForm.outcome === 'meeting_scheduled' && (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              <Label htmlFor="call-meeting">📅 Scheduled Meeting Date & Time *</Label>
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
            <Label htmlFor="call-notes">Private Comments / Follow-up Notes</Label>
            <Textarea
              id="call-notes"
              placeholder="Type comments about call outcome, negotiations, requirements, or thoughts on the deal..."
              value={callForm.notes}
              onChange={e => setCallForm(p => ({ ...p, notes: e.target.value }))}
              rows={4}
            />
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => setCallModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {callForm.outcome === 'won' ? 'Proceed to Close Deal' : 'Save Log'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Close Won Deal Wizard ───────────────────────────────────── */}
      <Modal isOpen={closeWonModalOpen} onClose={() => setCloseWonModalOpen(false)} title="🏆 Close Deal Won: Setup Kickoff">
        <form onSubmit={handleCloseWonSubmit} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
              {errorMsg}
            </div>
          )}

          {/* Stepper Header */}
          <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase border-b pb-2">
            <span className={closeWonStep === 1 ? 'text-indigo-600' : ''}>1. Contract Spec</span>
            <ArrowRight className="size-3" />
            <span className={closeWonStep === 2 ? 'text-indigo-600' : ''}>2. Setup Task</span>
          </div>

          {/* STEP 1: Contract details */}
          {closeWonStep === 1 && (
            <div className="flex flex-col gap-4 py-1">
              <div className="bg-green-50/50 border border-green-100 p-3 rounded-lg text-xs font-medium text-green-950">
                🎉 Congratulations! Let&apos;s finalize the contract details. The client will be logged in the client manager automatically.
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="won-contract-name">Contract Name *</Label>
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
                  <Label htmlFor="won-amount">Deal Value ($) *</Label>
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
                  <Label htmlFor="won-billing">Billing Type</Label>
                  <Select
                    value={closeWonForm.is_recurring ? 'recurring' : 'one_time'}
                    onValueChange={v => setCloseWonForm(p => ({ ...p, is_recurring: v === 'recurring' }))}
                  >
                    <SelectTrigger id="won-billing">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recurring">🔁 Recurring Revenue</SelectItem>
                      <SelectItem value="one_time">💰 One-Time / Single Pay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {closeWonForm.is_recurring && (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="won-cycle">Billing Cycle</Label>
                    <Select
                      value={closeWonForm.billing_cycle}
                      onValueChange={v => setCloseWonForm(p => ({ ...p, billing_cycle: v || 'monthly' }))}
                    >
                      <SelectTrigger id="won-cycle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="won-renewal">First Renewal Date</Label>
                    <Input
                      id="won-renewal"
                      type="date"
                      value={closeWonForm.renewal_date}
                      onChange={e => setCloseWonForm(p => ({ ...p, renewal_date: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t">
                <Button type="button" onClick={() => setCloseWonStep(2)} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  Next Step <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Kickoff Task specs */}
          {closeWonStep === 2 && (
            <div className="flex flex-col gap-4 py-1">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-title">Kickoff Task Title *</Label>
                <Input
                  id="task-title"
                  placeholder="e.g. Kickoff Content Reel"
                  value={closeWonForm.taskTitle}
                  onChange={e => setCloseWonForm(p => ({ ...p, taskTitle: e.target.value }))}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-description">Kickoff Task Description</Label>
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
                  <Label htmlFor="task-priority">Task Priority</Label>
                  <Select
                    value={closeWonForm.taskPriority}
                    onValueChange={v => setCloseWonForm(p => ({ ...p, taskPriority: v || 'medium' }))}
                  >
                    <SelectTrigger id="task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">🟢 Low</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="high">🟠 High</SelectItem>
                      <SelectItem value="urgent">🔴 Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="task-due">Task Deadline *</Label>
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
                <h4 className="text-xs font-bold mb-3 uppercase tracking-wider text-muted-foreground">🎥 Content Assets & Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="task-content-type">Content Type</Label>
                    <Select
                      value={closeWonForm.taskContentType}
                      onValueChange={v => setCloseWonForm(p => ({ ...p, taskContentType: v || 'other' }))}
                    >
                      <SelectTrigger id="task-content-type">
                        <SelectValue placeholder="— Select Content Type —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="post">Post</SelectItem>
                        <SelectItem value="story">Story</SelectItem>
                        <SelectItem value="reel">Reel</SelectItem>
                        <SelectItem value="photos">Photos</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="task-drive-link">Google Drive Link</Label>
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
                  <Label htmlFor="task-content-desc">Content Details</Label>
                  <Textarea
                    id="task-content-desc"
                    placeholder="Specify caption, hashtags, sizing, or reference guidelines..."
                    value={closeWonForm.taskContentDescription}
                    onChange={e => setCloseWonForm(p => ({ ...p, taskContentDescription: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>

              {/* Project & Assignees */}
              <div className="border-t border-border pt-4 flex flex-col gap-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">📂 Project Link & Assignees</h4>
                
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="task-project-id">Link to Project</Label>
                  <Select
                    value={closeWonForm.taskProjectId || 'new'}
                    onValueChange={v => setCloseWonForm(p => ({ ...p, taskProjectId: v || 'new' }))}
                  >
                    <SelectTrigger id="task-project-id">
                      <SelectValue placeholder="🆕 Auto-create New Project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">🆕 Auto-create New Project</SelectItem>
                      {projects.filter(p => p.client_id === selectedLead?.id).map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          📂 {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="mb-1 block">👥 Assign To</Label>
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
                    <Select value={assigneePickerId} onValueChange={val => setAssigneePickerId(val || '')}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="— Select a member to add —" />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedMembers.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={addAssignee} disabled={!assigneePickerId}>
                      <Plus className="size-4" /> Add
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t mt-2">
                <Button type="button" variant="outline" onClick={() => setCloseWonStep(1)} disabled={submitting}>Back</Button>
                <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  🚀 Complete Close Won
                </Button>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}

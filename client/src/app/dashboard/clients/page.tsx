'use client';

import { useEffect, useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { clientsApi, projectsApi, tasksApi } from '@/lib/api';
import { Client, Project, Task } from '@/types';
import Modal from '@/components/Modal';
import ProjectCard from '@/components/ProjectCard';
import ClientCard from '@/components/ClientCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/lib/i18n';
import { getCairoDateParts, formatCairoDate } from '@/lib/dateUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  MapPin,
  Calendar,
  Briefcase,
  ListTodo,
  Loader2,
  BarChart3,
  Check,
} from 'lucide-react';

function formatDate(dateStr?: string, locale?: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}


function getCompletionRate(projectTasks: Task[]): number {
  if (projectTasks.length === 0) return 0;
  const completed = projectTasks.filter(t => {
    if (!t.task_assignees || t.task_assignees.length === 0) return false;
    return t.task_assignees.every(a => a.status === 'completed');
  }).length;
  return Math.round((completed / projectTasks.length) * 100);
}

const PROJECT_STATUS_CONFIG: Record<string, { labelKey: string; className: string }> = {
  planning: { labelKey: 'clients.planning', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  active: { labelKey: 'clients.active', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  on_hold: { labelKey: 'clients.onHold', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  completed: { labelKey: 'status.completed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
};

function formatCurrency(amount: number, locale?: string): string {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
  return formatted.replace('US$', '$').replace('USD', '$').replace('دولار أمريكي', '$');
}

const PIPELINE_STAGE_CONFIG: Record<string, { labelKey: string; className: string }> = {
  new_lead:          { labelKey: 'sales.newLead',       className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  contacted:         { labelKey: 'sales.contacted',      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  meeting_scheduled: { labelKey: 'sales.meetingScheduled', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  meeting_done:      { labelKey: 'sales.meetingDone',    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  won:               { labelKey: 'sales.won',            className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  lost:              { labelKey: 'sales.lost',           className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
};

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}






export default function ClientsDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale } = useLanguage();

  // Navigation Guard: only owner (admin), team_leader, or account_manager
  useEffect(() => {
    if (user && !['owner', 'team_leader', 'account_manager'].includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // General States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'clients' | 'projects' | 'reports'>('clients');

  // Custom Reports states
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportClients, setReportClients] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportSelectedStages, setReportSelectedStages] = useState<string[]>([]);
  const [reportSelectedStatuses, setReportSelectedStatuses] = useState<string[]>([]);
  const [reportSelectedSalesReps, setReportSelectedSalesReps] = useState<string[]>([]);
  
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSalesRepDropdown, setShowSalesRepDropdown] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Search Filters
  const [clientSearch, setClientSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');

  // Expanded states
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Modals States
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected for Edit
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Progress tracking modal
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressClient, setProgressClient] = useState<Client | null>(null);
  const [progressForm, setProgressForm] = useState({
    done_posts: 0,
    done_reels: 0,
    done_stories: 0,
    done_photos: 0,
    done_other: false,
  });
  const [savingProgress, setSavingProgress] = useState(false);

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
  });

  // Project Form State
  const [projectForm, setProjectForm] = useState({
    client_id: '',
    name: '',
    description: '',
    status: 'active' as Project['status'],
    budget: '',
    start_date: '',
    end_date: '',
  });

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [clientsRes, projectsRes, tasksRes] = await Promise.all([
        clientsApi.list().catch(() => ({ clients: [] })),
        projectsApi.list().catch(() => ({ projects: [] })),
        tasksApi.list().catch(() => ({ tasks: [] })),
      ]);
      setClients(clientsRes.clients || []);
      setProjects(projectsRes.projects || []);
      setTasks(tasksRes.tasks || []);
    } catch (err) {
      console.error('Failed to load clients and projects', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (user && ['owner', 'team_leader', 'account_manager'].includes(user.role)) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'reports' && user?.role !== 'owner') {
      setActiveTab('clients');
    }
  }, [activeTab, user]);

  useEffect(() => {
    const parts = getCairoDateParts();
    const todayStr = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    const firstDayStr = `${parts.year}-${String(parts.month).padStart(2, '0')}-01`;
    setReportStartDate(firstDayStr);
    setReportEndDate(todayStr);
  }, []);

  const loadCustomReport = async (start: string, end: string) => {
    if (user?.role !== 'owner') return;
    try {
      setReportLoading(true);
      const data = await clientsApi.customReport(start, end);
      const clientsList = data.clients || [];
      setReportClients(clientsList);

      const uniqueStages = Array.from(new Set(clientsList.map((c: any) => c.pipeline_stage).filter(Boolean))) as string[];
      setReportSelectedStages(uniqueStages);

      const uniqueStatuses = Array.from(new Set(clientsList.map((c: any) => c.status).filter(Boolean))) as string[];
      setReportSelectedStatuses(uniqueStatuses);

      const uniqueSalesReps = Array.from(new Set(clientsList.map((c: any) => c.sales_rep?.name || 'Unassigned'))) as string[];
      setReportSelectedSalesReps(uniqueSalesReps);
    } catch (err) {
      console.error('Failed to load custom report:', err);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports' && reportStartDate && reportEndDate && user?.role === 'owner') {
      loadCustomReport(reportStartDate, reportEndDate);
    }
  }, [activeTab, reportStartDate, reportEndDate, user]);

  const filteredReportClients = useMemo(() => {
    return reportClients.filter(item => {
      if (!reportSelectedStages.includes(item.pipeline_stage)) return false;
      if (!reportSelectedStatuses.includes(item.status)) return false;
      const repName = item.sales_rep?.name || 'Unassigned';
      if (!reportSelectedSalesReps.includes(repName)) return false;

      if (reportSearchQuery) {
        const query = reportSearchQuery.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(query);
        const companyMatch = item.company && item.company.toLowerCase().includes(query);
        const emailMatch = item.email && item.email.toLowerCase().includes(query);
        const phoneMatch = item.phone && item.phone.toLowerCase().includes(query);
        const repMatch = repName.toLowerCase().includes(query);
        
        if (!nameMatch && !companyMatch && !emailMatch && !phoneMatch && !repMatch) {
          return false;
        }
      }
      return true;
    });
  }, [reportClients, reportSelectedStages, reportSelectedStatuses, reportSelectedSalesReps, reportSearchQuery]);

  const reportKPIs = useMemo(() => {
    let newLeads = 0;
    let wonClients = 0;
    let totalContractValue = 0;

    filteredReportClients.forEach(c => {
      if (c.pipeline_stage === 'won') {
        wonClients += 1;
      } else {
        newLeads += 1;
      }
      const clientContractsVal = (c.contracts || []).reduce((sum: number, contract: any) => sum + (Number(contract.amount) || 0), 0);
      totalContractValue += clientContractsVal;
    });

    const total = filteredReportClients.length;
    const conversionRate = total > 0 ? Math.round((wonClients / total) * 1000) / 10 : 0;

    return { newLeads, wonClients, conversionRate, totalContractValue };
  }, [filteredReportClients]);

  const exportToCSV = () => {
    let csvContent = '\uFEFF';
    csvContent += `"${t('clients.reportTitle')}"\n`;
    csvContent += `"${t('team.startDate')}: ${reportStartDate} | ${t('team.endDate')}: ${reportEndDate}"\n\n`;
    
    csvContent += `"${t('clients.newLeadsKPI')}","${reportKPIs.newLeads}"\n`;
    csvContent += `"${t('clients.wonClientsKPI')}","${reportKPIs.wonClients}"\n`;
    csvContent += `"${t('clients.conversionRateKPI')}","${reportKPIs.conversionRate}%"\n`;
    csvContent += `"${t('clients.contractValueKPI')}","${formatCurrency(reportKPIs.totalContractValue, locale)}"\n\n`;
    
    csvContent += `"${t('clients.createdDate')}","${t('clients.startDateCol')}","${t('clients.clientName')}","${t('clients.company')}","${t('clients.phone')}","${t('clients.salesRepCol')}","${t('clients.stageCol')}","${t('clients.statusCol')}","${t('clients.valueCol')}"\n`;
    
    filteredReportClients.forEach(c => {
      const createdDateStr = c.created_at ? c.created_at.substring(0, 10) : 'N/A';
      const startDateStr = c.start_date ? c.start_date.substring(0, 10) : 'N/A';
      const clientName = c.name || '';
      const company = c.company || '';
      const phone = c.phone || '';
      const salesRep = c.sales_rep?.name || 'Unassigned';
      const stage = t(PIPELINE_STAGE_CONFIG[c.pipeline_stage]?.labelKey || 'sales.newLead');
      const status = c.status === 'active' ? t('clients.active') : t('clients.inactive');
      const value = (c.contracts || []).reduce((sum: number, contract: any) => sum + (Number(contract.amount) || 0), 0);
      
      csvContent += `"${createdDateStr}","${startDateStr}","${clientName}","${company}","${phone}","${salesRep}","${stage}","${status}","${value}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clients_report_${reportStartDate}_to_${reportEndDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderCustomReportView = () => {
    const uniqueStages = Array.from(new Set(reportClients.map((c: any) => c.pipeline_stage).filter(Boolean))) as string[];
    const uniqueStatuses = Array.from(new Set(reportClients.map((c: any) => c.status).filter(Boolean))) as string[];
    const uniqueSalesReps = Array.from(new Set(reportClients.map((c: any) => c.sales_rep?.name || 'Unassigned'))) as string[];

    const toggleStage = (stage: string) => {
      setReportSelectedStages(prev =>
        prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
      );
    };

    const toggleAllStages = () => {
      if (reportSelectedStages.length === uniqueStages.length) {
        setReportSelectedStages([]);
      } else {
        setReportSelectedStages(uniqueStages);
      }
    };

    const toggleStatus = (status: string) => {
      setReportSelectedStatuses(prev =>
        prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
      );
    };

    const toggleAllStatuses = () => {
      if (reportSelectedStatuses.length === uniqueStatuses.length) {
        setReportSelectedStatuses([]);
      } else {
        setReportSelectedStatuses(uniqueStatuses);
      }
    };

    const toggleSalesRep = (rep: string) => {
      setReportSelectedSalesReps(prev =>
        prev.includes(rep) ? prev.filter(r => r !== rep) : [...prev, rep]
      );
    };

    const toggleAllSalesReps = () => {
      if (reportSelectedSalesReps.length === uniqueSalesReps.length) {
        setReportSelectedSalesReps([]);
      } else {
        setReportSelectedSalesReps(uniqueSalesReps);
      }
    };

    return (
      <div className="flex flex-col gap-6">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #print-clients-report-area, #print-clients-report-area * {
              visibility: visible;
            }
            #print-clients-report-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              color: black !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}} />

        <div className="no-print p-5 bg-card border rounded-xl shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-end flex-wrap">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex flex-col gap-1.5 text-start">
              <Label className="text-xs font-semibold text-muted-foreground">{t('team.startDate')}</Label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={reportStartDate}
                onChange={e => setReportStartDate(e.target.value)}
              />
            </div>
            <span className="text-muted-foreground pb-2">—</span>
            <div className="flex flex-col gap-1.5 text-start">
              <Label className="text-xs font-semibold text-muted-foreground">{t('team.endDate')}</Label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={reportEndDate}
                onChange={e => setReportEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-1 gap-3 w-full md:w-auto flex-wrap">
            <div className="relative flex-1 min-w-[150px] text-start">
              <Label className="text-xs font-semibold text-muted-foreground block mb-1.5">{t('clients.filterStages')}</Label>
              <button
                type="button"
                onClick={() => { setShowStageDropdown(!showStageDropdown); setShowStatusDropdown(false); setShowSalesRepDropdown(false); }}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs hover:bg-accent/50 focus:outline-hidden"
              >
                <span className="truncate">
                  {reportSelectedStages.length === uniqueStages.length
                    ? t('clients.allStagesSelected')
                    : t('clients.stagesSelected').replace('{count}', reportSelectedStages.length.toString())}
                </span>
                <span className="text-[10px] opacity-50">▼</span>
              </button>

              {showStageDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStageDropdown(false)} />
                  <div className="absolute top-[100%] left-0 right-0 z-50 mt-1.5 bg-card border rounded-lg shadow-md max-h-56 overflow-y-auto p-2">
                    <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs font-bold border-b mb-1 select-none">
                      <input
                        type="checkbox"
                        checked={reportSelectedStages.length === uniqueStages.length}
                        onChange={toggleAllStages}
                      />
                      {t('finance.allCategories')}
                    </label>
                    {uniqueStages.map(stage => (
                      <label key={stage} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs hover:bg-muted rounded-md select-none transition-colors">
                        <input
                          type="checkbox"
                          checked={reportSelectedStages.includes(stage)}
                          onChange={() => toggleStage(stage)}
                        />
                        {t(PIPELINE_STAGE_CONFIG[stage]?.labelKey || stage)}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative flex-1 min-w-[150px] text-start">
              <Label className="text-xs font-semibold text-muted-foreground block mb-1.5">{t('clients.filterStatuses')}</Label>
              <button
                type="button"
                onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowStageDropdown(false); setShowSalesRepDropdown(false); }}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs hover:bg-accent/50 focus:outline-hidden"
              >
                <span className="truncate">
                  {reportSelectedStatuses.length === uniqueStatuses.length
                    ? t('clients.allStatusesSelected')
                    : t('clients.statusesSelected').replace('{count}', reportSelectedStatuses.length.toString())}
                </span>
                <span className="text-[10px] opacity-50">▼</span>
              </button>

              {showStatusDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStatusDropdown(false)} />
                  <div className="absolute top-[100%] left-0 right-0 z-50 mt-1.5 bg-card border rounded-lg shadow-md max-h-56 overflow-y-auto p-2">
                    <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs font-bold border-b mb-1 select-none">
                      <input
                        type="checkbox"
                        checked={reportSelectedStatuses.length === uniqueStatuses.length}
                        onChange={toggleAllStatuses}
                      />
                      {t('finance.allCategories')}
                    </label>
                    {uniqueStatuses.map(status => (
                      <label key={status} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs hover:bg-muted rounded-md select-none transition-colors">
                        <input
                          type="checkbox"
                          checked={reportSelectedStatuses.includes(status)}
                          onChange={() => toggleStatus(status)}
                        />
                        {status === 'active' ? t('clients.active') : t('clients.inactive')}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative flex-1 min-w-[180px] text-start">
              <Label className="text-xs font-semibold text-muted-foreground block mb-1.5">{t('clients.filterSalesReps')}</Label>
              <button
                type="button"
                onClick={() => { setShowSalesRepDropdown(!showSalesRepDropdown); setShowStageDropdown(false); setShowStatusDropdown(false); }}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs hover:bg-accent/50 focus:outline-hidden"
              >
                <span className="truncate">
                  {reportSelectedSalesReps.length === uniqueSalesReps.length
                    ? t('clients.allSalesRepsSelected')
                    : t('clients.salesRepsSelected').replace('{count}', reportSelectedSalesReps.length.toString())}
                </span>
                <span className="text-[10px] opacity-50">▼</span>
              </button>

              {showSalesRepDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSalesRepDropdown(false)} />
                  <div className="absolute top-[100%] left-0 right-0 z-50 mt-1.5 bg-card border rounded-lg shadow-md max-h-56 overflow-y-auto p-2">
                    <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs font-bold border-b mb-1 select-none">
                      <input
                        type="checkbox"
                        checked={reportSelectedSalesReps.length === uniqueSalesReps.length}
                        onChange={toggleAllSalesReps}
                      />
                      {t('finance.allCategories')}
                    </label>
                    {uniqueSalesReps.map(rep => (
                      <label key={rep} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs hover:bg-muted rounded-md select-none transition-colors">
                        <input
                          type="checkbox"
                          checked={reportSelectedSalesReps.includes(rep)}
                          onChange={() => toggleSalesRep(rep)}
                        />
                        {rep}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 min-w-[200px] text-start">
              <Label className="text-xs font-semibold text-muted-foreground block mb-1.5">{t('finance.searchTransactions')}</Label>
              <Input
                type="text"
                placeholder={t('clients.searchClients')}
                value={reportSearchQuery}
                onChange={e => setReportSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <Button onClick={exportToCSV} className="h-9 shrink-0 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
            📊 {t('finance.exportExcel')}
          </Button>
        </div>

        {reportLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div id="print-clients-report-area" className="flex flex-col gap-6">
            <div className="hidden print:block border-b-2 pb-3 mb-2 text-start">
              <h2 className="text-xl font-bold text-foreground">{t('clients.reportTitle')}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t('team.startDate')}: <strong>{formatCairoDate(reportStartDate, locale)}</strong> | {t('team.endDate')}: <strong>{formatCairoDate(reportEndDate, locale)}</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-1 text-start">
                  <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                    <span>{t('clients.newLeadsKPI')}</span>
                    <span className="text-base">🎯</span>
                  </div>
                  <div className="text-2xl font-black text-foreground mt-2">
                    {reportKPIs.newLeads}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-1 text-start">
                  <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                    <span>{t('clients.wonClientsKPI')}</span>
                    <span className="text-base">🤝</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                    {reportKPIs.wonClients}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-1 text-start">
                  <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                    <span>{t('clients.conversionRateKPI')}</span>
                    <span className="text-base">📈</span>
                  </div>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                    {reportKPIs.conversionRate}%
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-1 text-start">
                  <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                    <span>{t('clients.contractValueKPI')}</span>
                    <span className="text-base">💰</span>
                  </div>
                  <div className="text-2xl font-black text-violet-600 dark:text-violet-400 mt-2 font-mono">
                    {formatCurrency(reportKPIs.totalContractValue, locale)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
              <div className="table-responsive">
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr className="text-xs text-muted-foreground bg-muted/20 border-b">
                      <th className="py-3 px-4 font-bold text-start">{t('clients.createdDate')}</th>
                      <th className="py-3 px-4 font-bold text-start">{t('clients.startDateCol')}</th>
                      <th className="py-3 px-4 font-bold text-start">{t('clients.clientName')}</th>
                      <th className="py-3 px-4 font-bold text-start">{t('clients.phone')}</th>
                      <th className="py-3 px-4 font-bold text-start">{t('clients.salesRepCol')}</th>
                      <th className="py-3 px-4 font-bold text-start">{t('clients.stageCol')}</th>
                      <th className="py-3 px-4 font-bold text-start">{t('clients.statusCol')}</th>
                      <th className="py-3 px-4 font-bold text-end">{t('clients.valueCol')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredReportClients.map(c => {
                      const stageCfg = PIPELINE_STAGE_CONFIG[c.pipeline_stage] || PIPELINE_STAGE_CONFIG.new_lead;
                      const clientContractsVal = (c.contracts || []).reduce((sum: number, contract: any) => sum + (Number(contract.amount) || 0), 0);

                      return (
                        <tr key={c.id} className="text-xs hover:bg-muted/5 transition-colors">
                          <td className="py-3 px-4 text-start font-mono text-muted-foreground">
                            {c.created_at ? formatCairoDate(c.created_at, locale) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-start font-mono text-muted-foreground">
                            {c.start_date ? formatCairoDate(c.start_date, locale) : '—'}
                          </td>
                          <td className="py-3 px-4 text-start font-semibold">
                            <div>{c.name}</div>
                            {c.company && <div className="text-[10px] font-normal text-muted-foreground mt-0.5">{c.company}</div>}
                          </td>
                          <td className="py-3 px-4 text-start font-mono text-muted-foreground">
                            {c.phone || '—'}
                          </td>
                          <td className="py-3 px-4 text-start text-muted-foreground">
                            {c.sales_rep?.name || <span className="italic text-[10px] text-muted-foreground/50">{t('common.unassigned')}</span>}
                          </td>
                          <td className="py-3 px-4 text-start">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${stageCfg.className}`}>
                              {t(stageCfg.labelKey)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-start">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === 'active' 
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              <span className={`size-1.5 rounded-full ${c.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {c.status === 'active' ? t('clients.active') : t('clients.inactive')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-end font-bold font-mono text-violet-600 dark:text-violet-400">
                            {formatCurrency(clientContractsVal, locale)}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredReportClients.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-muted-foreground text-sm font-semibold italic">
                          {t('clients.noReportsFound')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (user && ['owner', 'team_leader', 'account_manager'].includes(user.role)) {
      loadData();
    }
  }, [user]);

  if (!user || !['owner', 'team_leader', 'account_manager'].includes(user.role)) {
    return null;
  }

  // Reset Client Form
  const resetClientForm = (client?: Client) => {
    if (client) {
      setClientForm({
        name: client.name || '',
        company: client.company || '',
        email: client.email || '',
        phone: client.phone || '',
        status: client.status || 'active',
        pipeline_stage: client.pipeline_stage || 'won',
        start_date: client.start_date ? client.start_date.split('T')[0] : '',
        address: client.address || '',
        content_plan_link: client.content_plan_link || '',
        num_posts: client.num_posts ?? 0,
        num_reels: client.num_reels ?? 0,
        num_stories: client.num_stories ?? 0,
        num_photos: client.num_photos ?? 0,
        other_deliverables: client.other_deliverables || '',
      });
      setSelectedClient(client);
      setModalMode('edit');
    } else {
      setClientForm({
        name: '',
        company: '',
        email: '',
        phone: '',
        status: 'active',
        pipeline_stage: 'won',
        start_date: '',
        address: '',
        content_plan_link: '',
        num_posts: 0,
        num_reels: 0,
        num_stories: 0,
        num_photos: 0,
        other_deliverables: '',
      });
      setSelectedClient(null);
      setModalMode('create');
    }
    setErrorMsg('');
  };

  // Reset Project Form
  const resetProjectForm = (project?: Project, clientId?: string) => {
    if (project) {
      setProjectForm({
        client_id: project.client_id || '',
        name: project.name || '',
        description: project.description || '',
        status: project.status || 'active',
        budget: project.budget !== undefined ? project.budget.toString() : '',
        start_date: project.start_date ? project.start_date.split('T')[0] : '',
        end_date: project.end_date ? project.end_date.split('T')[0] : '',
      });
      setSelectedProject(project);
      setModalMode('edit');
    } else {
      setProjectForm({
        client_id: clientId || clients[0]?.id || '',
        name: '',
        description: '',
        status: 'active',
        budget: '',
        start_date: '',
        end_date: '',
      });
      setSelectedProject(null);
      setModalMode('create');
    }
    setErrorMsg('');
  };

  // Client Submit
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name) {
      setErrorMsg(t('team.nameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        await clientsApi.create(clientForm);
      } else if (selectedClient) {
        await clientsApi.update(selectedClient.id, clientForm);
      }
      setClientModalOpen(false);
      loadData(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Project Submit
  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.name || !projectForm.client_id) {
      setErrorMsg('Project Name and Client selection are required');
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        ...projectForm,
        budget: projectForm.budget ? Number(projectForm.budget) : 0,
      };
      if (modalMode === 'create') {
        await projectsApi.create(data);
      } else if (selectedProject) {
        await projectsApi.update(selectedProject.id, data);
      }
      setProjectModalOpen(false);
      loadData(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Handlers
  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(t('clients.deleteClientConfirm').replace('{name}', name))) return;
    try {
      await clientsApi.delete(id);
      loadData(true);
    } catch (err) {
      alert('Failed to delete client');
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(t('clients.deleteProjectConfirm').replace('{name}', name))) return;
    try {
      await projectsApi.delete(id);
      loadData(true);
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  // Helpers: get tasks for a specific project
  const getProjectTasks = (projectId: string): Task[] => {
    return tasks.filter(tTask => tTask.project_id === projectId);
  };

  // Open progress modal for a client
  const openProgressModal = (client: Client) => {
    setProgressClient(client);
    setProgressForm({
      done_posts: client.done_posts ?? 0,
      done_reels: client.done_reels ?? 0,
      done_stories: client.done_stories ?? 0,
      done_photos: client.done_photos ?? 0,
      done_other: client.done_other ?? false,
    });
    setProgressModalOpen(true);
  };

  // Save progress
  const handleProgressSave = async () => {
    if (!progressClient) return;
    setSavingProgress(true);
    try {
      await clientsApi.update(progressClient.id, progressForm);
      setProgressModalOpen(false);
      loadData(true);
    } catch (err) {
      alert('Failed to update progress');
    } finally {
      setSavingProgress(false);
    }
  };

  // Filter lists
  const filteredClients = clients.filter(c => {
    const q = clientSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const filteredProjects = projects.filter(p => {
    const q = projectSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.client?.name && p.client.name.toLowerCase().includes(q))
    );
  });

  // Group projects by client for Projects tab
  const projectsByClient: { client: Client; projects: Project[] }[] = [];
  const clientMap = new Map<string, Client>();
  clients.forEach(c => clientMap.set(c.id, c));

  const groupedMap = new Map<string, Project[]>();
  filteredProjects.forEach(p => {
    const cid = p.client_id;
    if (!groupedMap.has(cid)) groupedMap.set(cid, []);
    groupedMap.get(cid)!.push(p);
  });
  groupedMap.forEach((projs, cid) => {
    const client = clientMap.get(cid);
    if (client) {
      projectsByClient.push({ client, projects: projs });
    }
  });

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('clients.title')}</h1>
          <p className="page-header-subtitle">
            {t('clients.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'clients' ? (
            <Button onClick={() => { resetClientForm(); setClientModalOpen(true); }}>
              <Plus className="size-4 mr-2 rtl:ml-2 rtl:mr-0" /> {t('clients.addClient')}
            </Button>
          ) : activeTab === 'projects' ? (
            <Button onClick={() => { resetProjectForm(); setProjectModalOpen(true); }} disabled={clients.length === 0}>
              <Plus className="size-4 mr-2 rtl:ml-2 rtl:mr-0" /> {t('clients.createProject')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Tabs switcher */}
      <div className="flex border-b border-border mb-6 gap-6">
        <button
          onClick={() => setActiveTab('clients')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'clients'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          👥 {t('clients.clientsList')}
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'projects'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          🚀 {t('clients.projectsList')}
        </button>
        {user?.role === 'owner' && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'reports'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            📊 {t('clients.customReports')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ══════ 1. CLIENTS TAB ══════ */}
          {activeTab === 'clients' && (
            <div className="flex flex-col gap-4">
              {/* Search Bar */}
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4 rtl:left-auto rtl:right-3" />
                <Input
                  type="text"
                  placeholder={t('clients.searchClients')}
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="pl-9 rtl:pl-3 rtl:pr-9"
                />
              </div>

              {/* Clients Cards Grid */}
              {filteredClients.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredClients.map(c => {
                    const clientProjects = projects.filter(p => p.client_id === c.id);
                    const isExpanded = expandedClientId === c.id;

                    return (
                      <ClientCard
                        key={c.id}
                        client={c}
                        clientProjects={clientProjects}
                        getProjectTasks={getProjectTasks}
                        locale={locale}
                        t={t}
                        isExpanded={isExpanded}
                        onToggleExpand={() => setExpandedClientId(isExpanded ? null : c.id)}
                        onEditClick={(client) => {
                          resetClientForm(client);
                          setClientModalOpen(true);
                        }}
                        onDeleteClick={handleDeleteClient}
                        onUpdateProgressClick={openProgressModal}
                        expandedProjectId={expandedProjectId}
                        onToggleExpandProject={setExpandedProjectId}
                        onEditProjectClick={(proj) => {
                          resetProjectForm(proj);
                          setProjectModalOpen(true);
                        }}
                        onDeleteProjectClick={handleDeleteProject}
                        onNewProjectClick={(clientId) => {
                          resetProjectForm(undefined, clientId);
                          setProjectModalOpen(true);
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 border rounded-lg border-dashed text-muted-foreground text-sm bg-card">
                  {t('clients.noClientsFound')}
                </div>
              )}
            </div>
          )}

          {/* ══════ 2. PROJECTS TAB ══════ */}
          {activeTab === 'projects' && (
            <div className="flex flex-col gap-4">
              {/* Search Bar */}
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4 rtl:left-auto rtl:right-3" />
                <Input
                  type="text"
                  placeholder={t('clients.searchProjects')}
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  className="pl-9 rtl:pl-3 rtl:pr-9"
                />
              </div>

              {/* Projects grouped by client */}
              <div className="flex flex-col gap-6">
                {projectsByClient.map(({ client, projects: clientProjs }) => (
                  <div key={client.id} className="space-y-3">
                    {/* Client group header */}
                    <div className="flex items-center gap-3 px-1 text-start">
                      <div className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{client.name}</h3>
                        {client.company && <p className="text-xs text-muted-foreground">{client.company}</p>}
                      </div>
                      <Badge variant="outline" className="ml-auto rtl:ml-0 rtl:mr-auto text-xs">
                        {clientProjs.length} {t('clients.projects')}
                      </Badge>
                    </div>

                    {/* Project cards under this client */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-11 rtl:pl-0 rtl:pr-11">
                      {clientProjs.map(p => {
                        const pTasks = getProjectTasks(p.id);
                        const isProjExpanded = expandedProjectId === p.id;

                        return (
                          <ProjectCard
                            key={p.id}
                            project={p}
                            projectTasks={pTasks}
                            locale={locale}
                            t={t}
                            isExpanded={isProjExpanded}
                            onToggleExpand={() => setExpandedProjectId(isProjExpanded ? null : p.id)}
                            onEditClick={(proj) => {
                              resetProjectForm(proj);
                              setProjectModalOpen(true);
                            }}
                            onDeleteClick={handleDeleteProject}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {filteredProjects.length === 0 && (
                <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground text-sm">
                  {t('clients.noClientsFound')}
                </div>
              )}
            </div>
          )}

          {/* ══════ 3. CUSTOM REPORTS TAB ══════ */}
          {activeTab === 'reports' && user?.role === 'owner' && renderCustomReportView()}
        </>
      )}

      {/* ── CLIENT CREATE / EDIT MODAL ── */}
      <Modal
        isOpen={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        title={modalMode === 'create' ? t('clients.addClient') : t('clients.editClient')}
      >
        <form onSubmit={handleClientSubmit} className="flex flex-col gap-4 text-start">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-2.5 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_name">{t('clients.clientName')} *</Label>
            <Input
              id="c_name"
              placeholder="e.g. Khalifa Al-Kubaisi"
              value={clientForm.name}
              onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_company">{t('clients.company')}</Label>
            <Input
              id="c_company"
              placeholder="e.g. Sawaqly Marketing"
              value={clientForm.company}
              onChange={e => setClientForm({ ...clientForm, company: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c_email">{t('team.emailAddress')}</Label>
              <Input
                id="c_email"
                type="email"
                placeholder="client@company.com"
                value={clientForm.email}
                onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c_phone">{t('clients.phone')}</Label>
              <Input
                id="c_phone"
                placeholder="+974 5555-1234"
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
                onValueChange={v => setClientForm({ ...clientForm, status: (v || 'active') as Client['status'] })}
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
              <Label htmlFor="c_start_date">{t('finance.startDate')}</Label>
              <Input
                id="c_start_date"
                type="date"
                value={clientForm.start_date}
                onChange={e => setClientForm({ ...clientForm, start_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_address">{t('clients.addressTimeline')}</Label>
            <Textarea
              id="c_address"
              placeholder="Building, street name, city, country..."
              value={clientForm.address}
              onChange={e => setClientForm({ ...clientForm, address: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_content_plan">{t('clients.contentPlanLink')}</Label>
            <Input
              id="c_content_plan"
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={clientForm.content_plan_link}
              onChange={e => setClientForm({ ...clientForm, content_plan_link: e.target.value })}
            />
          </div>

          {/* Content Deliverables */}
          <div className="border-t border-border pt-4 text-start">
            <h4 className="text-sm font-bold mb-3">🎬 {t('clients.deliverables')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c_posts">{t('clients.numPosts')}</Label>
                <Input
                  id="c_posts"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={clientForm.num_posts}
                  onChange={e => setClientForm({ ...clientForm, num_posts: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c_reels">{t('clients.numReels')}</Label>
                <Input
                  id="c_reels"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={clientForm.num_reels}
                  onChange={e => setClientForm({ ...clientForm, num_reels: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c_stories">{t('clients.numStories')}</Label>
                <Input
                  id="c_stories"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={clientForm.num_stories}
                  onChange={e => setClientForm({ ...clientForm, num_stories: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c_photos">{t('clients.numPhotos')}</Label>
                <Input
                  id="c_photos"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={clientForm.num_photos}
                  onChange={e => setClientForm({ ...clientForm, num_photos: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-3">
              <Label htmlFor="c_other_deliverables">{t('clients.otherDeliverables')}</Label>
              <Input
                id="c_other_deliverables"
                placeholder="e.g. Brochures, Flyers, Brand Guidelines..."
                value={clientForm.other_deliverables}
                onChange={e => setClientForm({ ...clientForm, other_deliverables: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => setClientModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('clients.savingProgress') : t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── PROJECT CREATE / EDIT MODAL ── */}
      <Modal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        title={modalMode === 'create' ? t('clients.newProject') : t('clients.editProject')}
      >
        <form onSubmit={handleProjectSubmit} className="flex flex-col gap-4 text-start">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-2.5 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p_client">{t('clients.selectClient')} *</Label>
            <Select
              value={projectForm.client_id}
              onValueChange={v => setProjectForm({ ...projectForm, client_id: v || '' })}
            >
              <SelectTrigger id="p_client">
                <SelectValue placeholder={t('clients.selectClient')} />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p_name">{t('clients.projectName')} *</Label>
            <Input
              id="p_name"
              placeholder="e.g. Q3 SEO Optimization"
              value={projectForm.name}
              onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p_desc">{t('clients.projectDescription')}</Label>
            <Textarea
              id="p_desc"
              placeholder="Describe targets, deliverables, details..."
              value={projectForm.description}
              onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p_status">{t('clients.statusLabel')}</Label>
            <Select
              value={projectForm.status}
              onValueChange={v => setProjectForm({ ...projectForm, status: v as Project['status'] })}
            >
              <SelectTrigger id="p_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">📝 {t('clients.planning')}</SelectItem>
                <SelectItem value="active">⚡ {t('clients.active')}</SelectItem>
                <SelectItem value="on_hold">🔄 {t('clients.onHold')}</SelectItem>
                <SelectItem value="completed">✅ {t('status.completed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p_start">{t('clients.startDate')}</Label>
              <Input
                id="p_start"
                type="date"
                value={projectForm.start_date}
                onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p_end">{t('clients.endDate')}</Label>
              <Input
                id="p_end"
                type="date"
                value={projectForm.end_date}
                onChange={e => setProjectForm({ ...projectForm, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => setProjectModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('clients.savingProgress') : (modalMode === 'create' ? t('clients.createProjectBtn') : t('common.saveChanges'))}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── PROGRESS UPDATE MODAL ── */}
      <Modal
        isOpen={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
        title={`${t('clients.progressTitle')} — ${progressClient?.name || ''}`}
      >
        <div className="flex flex-col gap-5 text-start">
          <p className="text-xs text-muted-foreground">
            {t('clients.progressTitle')}
          </p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'done_posts', label: t('clients.donePosts'), total: progressClient?.num_posts ?? 0 },
              { key: 'done_reels', label: t('clients.doneReels'), total: progressClient?.num_reels ?? 0 },
              { key: 'done_stories', label: t('clients.doneStories'), total: progressClient?.num_stories ?? 0 },
              { key: 'done_photos', label: t('clients.donePhotos'), total: progressClient?.num_photos ?? 0 },
            ].map(item => (
              <div key={item.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`prog_${item.key}`}>
                  {item.label} <span className="text-muted-foreground font-normal">/ {item.total}</span>
                </Label>
                <Input
                  id={`prog_${item.key}`}
                  type="number"
                  min="0"
                  max={item.total}
                  value={(progressForm as any)[item.key]}
                  onChange={e => setProgressForm(prev => ({
                    ...prev,
                    [item.key]: parseInt(e.target.value) || 0,
                  }))}
                />
              </div>
            ))}
          </div>

          {/* Others toggle */}
          {progressClient?.other_deliverables && (
            <div className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{t('clients.others')}</div>
                <div className="text-xs text-muted-foreground">{progressClient.other_deliverables}</div>
              </div>
              <button
                type="button"
                onClick={() => setProgressForm(prev => ({ ...prev, done_other: !prev.done_other }))}
                className={`size-8 rounded-md border-2 flex items-center justify-center transition-all ${
                  progressForm.done_other
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-border bg-background hover:border-muted-foreground/50'
                }`}
              >
                {progressForm.done_other && <Check className="size-4" />}
              </button>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button variant="outline" onClick={() => setProgressModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleProgressSave} disabled={savingProgress}>
              {savingProgress ? (
                <><Loader2 className="size-4 animate-spin mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('clients.savingProgress')}</>
              ) : (
                <><Check className="size-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('clients.saveProgress')}</>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

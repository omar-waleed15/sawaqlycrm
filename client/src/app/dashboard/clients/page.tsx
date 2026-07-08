'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { clientsApi, tasksApi, usersApi } from '@/lib/api';
import { Client, Task } from '@/types';
import Modal from '@/components/Modal';
import PotentialClientCard from '@/components/PotentialClientCard';
import ClosedDealCard from '@/components/ClosedDealCard';
import CloseWonModal from '@/components/CloseWonModal';
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


// Cairo local date helper


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
  const [activeTab, setActiveTab] = useState<'clients' | 'reports'>('clients');
  const [subTab, setSubTab] = useState<'potential' | 'won'>('potential');
  const [closeWonOpen, setCloseWonOpen] = useState(false);
  const [clientToClose, setClientToClose] = useState<Client | null>(null);
  const [teamMembers, setTeamMembers] = useState<import('@/types').User[]>([]);
  const [allTeamUsers, setAllTeamUsers] = useState<import('@/types').User[]>([]);

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
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Search Filters
  const [clientSearch, setClientSearch] = useState('');

  // Expanded states
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // Modals States
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected for Edit
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Client Users List State
  const [clientUsers, setClientUsers] = useState<import('@/types').User[]>([]);

  // Inline account creation states
  const [createAccountInline, setCreateAccountInline] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');

  // Client Form State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    status: 'active' as Client['status'],
    pipeline_stage: 'new_lead' as Client['pipeline_stage'],
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
    sales_rep_id: '',
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

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [clientsRes, tasksRes, usersRes] = await Promise.all([
        clientsApi.list().catch(() => ({ clients: [] })),
        tasksApi.list().catch(() => ({ tasks: [] })),
        usersApi.list().catch(() => ({ users: [] })),
      ]);
      setClients(clientsRes.clients || []);
      setTasks(tasksRes.tasks || []);
      setClientUsers((usersRes.users || []).filter((u: any) => u.role === 'client'));
      setTeamMembers((usersRes.users || []).filter((u: any) => u.role === 'sales'));
      setAllTeamUsers((usersRes.users || []).filter((u: any) => u.role !== 'client'));
    } catch (err) {
      console.error('Failed to load clients, tasks, and team', err);
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
        pipeline_stage: client.pipeline_stage || 'new_lead',
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
        sales_rep_id: client.sales_rep_id || '',
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
        pipeline_stage: 'new_lead',
        start_date: '',
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
        sales_rep_id: '',
      });
      setSelectedClient(null);
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
    setErrorMsg('');
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

  // Filter lists
  const potentialClients = clients.filter(c => c.pipeline_stage !== 'won' && c.sales_rep_id);
  const wonClients = clients.filter(c => c.pipeline_stage === 'won' && c.sales_rep_id);

  const filteredClients = (subTab === 'potential' ? potentialClients : wonClients).filter(c => {
    const q = clientSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
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
          {activeTab === 'clients' && (
            <Button onClick={() => { resetClientForm(); setClientModalOpen(true); }}>
              <Plus className="size-4 mr-2 rtl:ml-2 rtl:mr-0" /> {t('clients.addClient')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs switcher */}
      <div className="flex border-b border-border mb-6 gap-6">
        <button
          onClick={() => setActiveTab('clients')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'clients'
              ? 'border-[#1D61E7] text-[#1D61E7] dark:border-[#1D61E7] dark:text-[#1D61E7]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          👥 {t('clients.clientsList')}
        </button>
        {user?.role === 'owner' && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'reports'
                ? 'border-[#1D61E7] text-[#1D61E7] dark:border-[#1D61E7] dark:text-[#1D61E7]'
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
            <div className="flex flex-col gap-4 text-start">
              {/* Sub-tabs for Potential vs Closed Won */}
              <div className="flex gap-2">
                <Button
                  variant={subTab === 'potential' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSubTab('potential')}
                  className="text-xs font-semibold"
                >
                  🎯 {t('sales.leads') || 'Potential Leads'} ({potentialClients.length})
                </Button>
                <Button
                  variant={subTab === 'won' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSubTab('won')}
                  className="text-xs font-semibold"
                >
                  🏆 {t('sales.won') || 'Closed Won'} ({wonClients.length})
                </Button>
              </div>

              {/* Potential leads KPI metrics */}
              {subTab === 'potential' && potentialClients.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2 text-start">
                  <Card className="bg-slate-50/50 dark:bg-slate-900/10 border-border/80">
                    <CardContent className="p-3">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">{t('sales.newLead') || 'New Leads'}</span>
                      <p className="text-lg font-black text-foreground mt-0.5">{potentialClients.filter(c => c.pipeline_stage === 'new_lead').length}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-border/80">
                    <CardContent className="p-3">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">{t('sales.contacted') || 'Contacted'}</span>
                      <p className="text-lg font-black text-foreground mt-0.5">{potentialClients.filter(c => c.pipeline_stage === 'contacted').length}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-indigo-50/50 dark:bg-indigo-900/10 border-border/80">
                    <CardContent className="p-3">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">{t('sales.meetingScheduled') || 'Meetings'}</span>
                      <p className="text-lg font-black text-foreground mt-0.5">{potentialClients.filter(c => c.pipeline_stage === 'meeting_scheduled' || c.pipeline_stage === 'meeting_done').length}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-rose-50/50 dark:bg-rose-900/10 border-border/80">
                    <CardContent className="p-3">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">{t('sales.lost') || 'Lost'}</span>
                      <p className="text-lg font-black text-foreground mt-0.5">{potentialClients.filter(c => c.pipeline_stage === 'lost').length}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

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
                    const isExpanded = expandedClientId === c.id;

                    if (subTab === 'potential') {
                      return (
                        <PotentialClientCard
                          key={c.id}
                          client={c}
                          locale={locale}
                          t={t}
                          isExpanded={isExpanded}
                          onToggleExpand={() => setExpandedClientId(isExpanded ? null : c.id)}
                          onEditClick={(client) => {
                            resetClientForm(client);
                            setClientModalOpen(true);
                          }}
                          onDeleteClick={handleDeleteClient}
                          onCloseWonClick={(client) => {
                            setClientToClose(client);
                            setCloseWonOpen(true);
                          }}
                          onUpdate={() => loadData(true)}
                        />
                      );
                    } else {
                      return (
                        <ClosedDealCard
                          key={c.id}
                          client={c}
                          locale={locale}
                          t={t}
                          onEditClick={(client) => {
                            resetClientForm(client);
                            setClientModalOpen(true);
                          }}
                          onDeleteClick={handleDeleteClient}
                        />
                      );
                    }
                  })}
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground text-sm bg-card w-full">
                  {t('clients.noClientsFound')}
                </div>
              )}
            </div>
          )}

          {/* ══════ 2. CUSTOM REPORTS TAB ══════ */}
          {activeTab === 'reports' && user?.role === 'owner' && renderCustomReportView()}
        </>
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_address">{t('clients.address') || 'Address'}</Label>
            <Textarea
              id="c_address"
              placeholder="Building, street name, city, country..."
              value={clientForm.address}
              onChange={e => setClientForm({ ...clientForm, address: e.target.value })}
              rows={2}
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

          <div className="grid grid-cols-3 gap-4">
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
              <Label htmlFor="c_pipeline_stage">{t('clients.stageCol') || 'Pipeline Stage'}</Label>
              <Select
                value={clientForm.pipeline_stage}
                onValueChange={v => setClientForm({ ...clientForm, pipeline_stage: (v || 'new_lead') as Client['pipeline_stage'] })}
              >
                <SelectTrigger id="c_pipeline_stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_lead">{t('sales.newLead')}</SelectItem>
                  <SelectItem value="contacted">{t('sales.contacted')}</SelectItem>
                  <SelectItem value="meeting_scheduled">{t('sales.meetingScheduled')}</SelectItem>
                  <SelectItem value="meeting_done">{t('sales.meetingDone')}</SelectItem>
                  <SelectItem value="lost">{t('sales.lost')}</SelectItem>
                  <SelectItem value="won">{t('sales.won')}</SelectItem>
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
            <Label htmlFor="c_sales_rep">{t('clients.salesRepCol') || 'Sales Representative'}</Label>
            <Select
              value={clientForm.sales_rep_id || 'none'}
              onValueChange={v => setClientForm({ ...clientForm, sales_rep_id: v === 'none' ? '' : (v || '') })}
            >
              <SelectTrigger id="c_sales_rep">
                <span className="truncate">
                  {clientForm.sales_rep_id
                    ? `👤 ${allTeamUsers.find(u => u.id === clientForm.sales_rep_id)?.name || clientForm.sales_rep_id}`
                    : "Select sales rep..."}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    👤 {m.name} ({m.role})
                  </SelectItem>
                ))}
                {clientForm.sales_rep_id && !teamMembers.some(m => m.id === clientForm.sales_rep_id) && (() => {
                  const rep = allTeamUsers.find(u => u.id === clientForm.sales_rep_id);
                  return (
                    <SelectItem value={clientForm.sales_rep_id}>
                      👤 {rep ? `${rep.name} (${rep.role})` : clientForm.sales_rep_id}
                    </SelectItem>
                  );
                })()}
              </SelectContent>
            </Select>
          </div>



          {clientForm.pipeline_stage === 'won' && (
            <>
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
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold">🎬 {t('clients.deliverables')}</h4>
                  {(clientForm.num_posts > 0 || clientForm.num_reels > 0 || clientForm.num_stories > 0 || clientForm.num_photos > 0) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setScheduleModalOpen(true)}
                      className="h-7 text-xs flex items-center gap-1"
                    >
                      <Calendar className="size-3" />
                      {t('clients.configureSchedule') || 'Configure Schedule Outline'}
                    </Button>
                  )}
                </div>
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
            </>
          )}

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

      {/* Schedule Configuration Modal */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={t('clients.configureScheduleTitle') || 'Configure Deliverables Schedule'}
      >
        <div className="flex flex-col gap-6 max-h-[70vh] overflow-y-auto px-1 py-2">
          <p className="text-xs text-muted-foreground">
            {t('clients.scheduleExplanation') || 'Pick calendar dates for each deliverable item. The system will use these day numbers to auto-schedule outline tasks for the upcoming months.'}
          </p>

          {(['posts', 'reels', 'stories', 'photos'] as const).map(typeKey => {
            const count = clientForm[
              typeKey === 'posts' ? 'num_posts' :
              typeKey === 'reels' ? 'num_reels' :
              typeKey === 'stories' ? 'num_stories' : 'num_photos'
            ] || 0;

            if (count === 0) return null;

            const labelMap = {
              posts: t('clients.posts') || 'Posts',
              reels: t('clients.reels') || 'Reels',
              stories: t('clients.stories') || 'Stories',
              photos: t('clients.photos') || 'Photos',
            };

            const singularLabelMap = {
              posts: t('closedClients.plan.post') || 'Post',
              reels: t('closedClients.plan.reel') || 'Reel',
              stories: t('closedClients.plan.story') || 'Story',
              photos: t('closedClients.plan.photo') || 'Photo',
            };

            return (
              <div key={typeKey} className="border-t border-border pt-4 first:border-0 first:pt-0 text-start">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  {labelMap[typeKey]} ({count})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: count }).map((_, idx) => {
                    const value = clientForm.deliverables_schedule?.[typeKey]?.[idx] || '';
                    return (
                      <div key={idx} className="flex flex-col gap-1">
                        <Label className="text-[10px] text-muted-foreground font-medium">
                          {singularLabelMap[typeKey]} {idx + 1}
                        </Label>
                        <Input
                          type="date"
                          value={value}
                          onChange={(e) => {
                            const currentList = [...(clientForm.deliverables_schedule?.[typeKey] || [])];
                            currentList[idx] = e.target.value;
                            setClientForm({
                              ...clientForm,
                              deliverables_schedule: {
                                ...clientForm.deliverables_schedule,
                                [typeKey]: currentList
                              }
                            });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
            <Button type="button" onClick={() => setScheduleModalOpen(false)}>
              {t('common.done')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Close Won Deal Modal */}
      <CloseWonModal
        isOpen={closeWonOpen}
        onClose={() => { setCloseWonOpen(false); setClientToClose(null); }}
        client={clientToClose}
        t={t}
        locale={locale}
        onSuccess={() => loadData(true)}
      />
    </div>
  );
}

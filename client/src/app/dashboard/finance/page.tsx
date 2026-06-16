'use client';

import { useEffect, useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { clientsApi, projectsApi, contractsApi, expensesApi, salariesApi, usersApi, financeAnalyticsApi } from '@/lib/api';
import { Client, Project, Contract, FinanceStats, Expense, Salary, User, ExpenseCategory, FinanceAnalyticsPayload } from '@/types';
import Modal from '@/components/Modal';
import { useLanguage } from '@/lib/i18n';
import { Loader2 } from 'lucide-react';

function formatCurrency(amount: number, locale?: string): string {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
  return formatted.replace('US$', '$').replace('USD', '$').replace('دولار أمريكي', '$');
}


function formatDate(dateStr?: string, locale?: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRenewalStatus(renewalDateStr?: string, status?: string, t?: any): { label: string; color: string; bg: string; isAlert: boolean } {
  if (!renewalDateStr || status !== 'active') return { label: t('clients.inactive'), color: '#64748b', bg: '#f1f5f9', isAlert: false };
  
  const today = new Date();
  const renewalDate = new Date(renewalDateStr);
  const diffTime = renewalDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: t('common.overdue'), color: '#e11d48', bg: '#fff1f2', isAlert: true };
  } else if (diffDays <= 7) {
    return { label: t('dashboard.needsAttention') + ` (${diffDays}d)`, color: '#ea580c', bg: '#fff7ed', isAlert: true };
  } else if (diffDays <= 30) {
    return { label: t('dashboard.needsAttention') + ` (${diffDays}d)`, color: '#d97706', bg: '#fef3c7', isAlert: true };
  }
  return { label: t('clients.active'), color: '#16a34a', bg: '#f0fdf4', isAlert: false };
}

const PROJECT_STATUS_CONFIG: Record<string, { labelKey: string; bg: string; color: string; accent: string }> = {
  planning:  { labelKey: 'clients.planning',       bg: '#f1f5f9', color: '#475569', accent: '#94a3b8' },
  active:    { labelKey: 'status.in_progress',   bg: '#eff6ff', color: '#1d4ed8', accent: '#3b82f6' },
  on_hold:   { labelKey: 'status.revision', bg: '#fff7ed', color: '#c2410c', accent: '#f97316' },
  completed: { labelKey: 'status.completed',      bg: '#f5f3ff', color: '#6d28d9', accent: '#8b5cf6' },
};


export default function FinanceDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale } = useLanguage();

  // Navigation Guard
  useEffect(() => {
    if (user && user.role !== 'owner') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // States
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
  const [installmentRows, setInstallmentRows] = useState<{ amount: string; due_date: string; note: string; id?: string; paid?: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'contracts' | 'expenses' | 'report'>('overview');

  // Analytics states
  const [analyticsData, setAnalyticsData] = useState<FinanceAnalyticsPayload | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Custom Reports states
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportLineItems, setReportLineItems] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportSelectedCategories, setReportSelectedCategories] = useState<string[]>([
    'recurring_contracts',
    'one_time_contracts',
    'salaries',
    'ads',
    'software',
    'office',
    'freelancer',
    'other'
  ]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Chart interactivity states
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [hoveredDonutIdx, setHoveredDonutIdx] = useState<number | null>(null);

  // Compute filtered data reactively
  const filteredData = useMemo(() => {
    if (!analyticsData) {
      return {
        monthly: [],
        projections: [],
        ltmRevenue: 0,
        ltmExpenses: 0,
        ltmNetProfit: 0,
        ltmMargin: 0,
      };
    }

    // 1. Process Monthly Data (Last 12 Months)
    const monthly = analyticsData.monthlyData.map(d => {
      const computedRevenue = d.collectedRevenue;
      const computedExpenses = Math.max(d.expenses, 0);
      const computedProfit = computedRevenue - computedExpenses;
      const computedMargin = computedRevenue > 0
        ? Math.round((computedProfit / computedRevenue) * 1000) / 10
        : 0;
      return { ...d, computedRevenue, computedExpenses, computedProfit, computedMargin };
    });

    // 2. Process Projections (Next 6 Months)
    const projections = analyticsData.projections.map(p => {
      const computedRevenue = p.projectedRecurringRevenue ?? p.projectedRevenue;
      const computedExpenses = Math.max(p.projectedExpenses, 0);
      const computedProfit = computedRevenue - computedExpenses;
      return { ...p, computedRevenue, computedExpenses, computedProfit };
    });

    // 3. LTM Metrics
    const ltmRevenue = monthly.reduce((sum, m) => sum + m.computedRevenue, 0);
    const ltmExpenses = monthly.reduce((sum, m) => sum + m.computedExpenses, 0);
    const ltmNetProfit = ltmRevenue - ltmExpenses;
    const ltmMargin = ltmRevenue > 0 ? (ltmNetProfit / ltmRevenue) * 100 : 0;

    return { monthly, projections, ltmRevenue, ltmExpenses, ltmNetProfit, ltmMargin };
  }, [analyticsData]);

  // Expenses & Salaries State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('');
  const [expenseMonthFilter, setExpenseMonthFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [expensesSubTab, setExpensesSubTab] = useState<'expenses' | 'salaries'>('expenses');
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'software' as ExpenseCategory,
    date: new Date().toISOString().split('T')[0],
    note: '',
    is_recurring: false,
    recurrence: 'monthly' as 'monthly' | 'yearly',
  });

  const [salaryForm, setSalaryForm] = useState({
    user_id: '',
    amount: '',
    paid: false,
    paid_date: (() => {
      const d = new Date();
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
    })(),
    is_recurring: true,
    recurrence: 'monthly' as 'monthly' | 'yearly',
    note: '',
  });
  const [salaryInstallmentRows, setSalaryInstallmentRows] = useState<{ id?: string; amount: string; due_date: string; paid: boolean; note: string }[]>([{ amount: '', due_date: '', paid: false, note: '' }]);
  const [expandedSalaryId, setExpandedSalaryId] = useState<string | null>(null);

  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedSalary, setSelectedSalary] = useState<Salary | null>(null);
  
  // Search states
  const [projectSearch, setProjectSearch] = useState('');
  const [contractSearch, setContractSearch] = useState('');

  // Hover states for UI
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Modal control states
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Selected entities for Edit mode
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Project form states
  const [projectForm, setProjectForm] = useState({
    client_id: '',
    name: '',
    description: '',
    status: 'active' as Project['status'],
    budget: '',
    start_date: '',
    end_date: '',
  });

  // Contract form states
  const [contractForm, setContractForm] = useState({
    client_id: '',
    project_id: '',
    name: '',
    amount: '',
    is_recurring: true,
    billing_cycle: 'monthly' as Contract['billing_cycle'],
    status: 'active' as Contract['status'],
    start_date: '',
    renewal_date: '',
  });

  const loadExpensesAndSalaries = async (monthStr: string) => {
    try {
      const [expRes, salRes] = await Promise.all([
        expensesApi.list({ month: monthStr }),
        salariesApi.list({ month: monthStr }),
      ]);
      setExpenses(expRes.expenses || []);
      setSalaries(salRes.salaries || []);
    } catch (err) {
      console.warn('Failed to load expenses/salaries:', err);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const res = await financeAnalyticsApi.getDashboard();
      setAnalyticsData(res);
    } catch (err) {
      console.error('Failed to load financial analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Load Data function
  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [statsRes, clientsRes, projectsRes, contractsRes, usersRes] = await Promise.all([
        contractsApi.stats().catch(() => ({ stats: null })),
        clientsApi.list().catch(() => ({ clients: [] })),
        projectsApi.list().catch(() => ({ projects: [] })),
        contractsApi.list().catch(() => ({ contracts: [] })),
        usersApi.list().catch(() => ({ users: [] })),
      ]);
      if (statsRes.stats) setStats(statsRes.stats);
      setClients(clientsRes.clients || []);
      setProjects(projectsRes.projects || []);
      setContracts(contractsRes.contracts || []);
      setUsersList(usersRes.users || []);
      
      await loadExpensesAndSalaries(expenseMonthFilter);

      if (activeTab === 'analytics') {
        await loadAnalytics();
      }
    } catch (err) {
      console.error('Failed to load operations data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadCustomReport = async (start: string, end: string) => {
    if (!start || !end) return;
    try {
      setReportLoading(true);
      const data = await financeAnalyticsApi.customReport(start, end);
      setReportLineItems(data.lineItems || []);
    } catch (err) {
      console.error('Failed to load custom report:', err);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    // Initialize custom report date range on mount (local timezone)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const formatDateStr = (date: Date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    setReportStartDate(formatDateStr(firstDay));
    setReportEndDate(formatDateStr(now));
  }, []);

  useEffect(() => {
    if (activeTab === 'report' && reportStartDate && reportEndDate) {
      loadCustomReport(reportStartDate, reportEndDate);
    }
  }, [activeTab, reportStartDate, reportEndDate]);

  useEffect(() => {
    if ((user?.role === 'owner' || user?.role === 'sales') && activeTab === 'expenses') {
      loadExpensesAndSalaries(expenseMonthFilter);
    }
  }, [user, activeTab, expenseMonthFilter]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [activeTab]);

  useEffect(() => {
    if (user?.role === 'owner' || user?.role === 'sales') {
      loadData();
    }
  }, [user]);

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'recurring_contracts': return '🔄 ' + t('finance.recurring');
      case 'one_time_contracts': return '💳 ' + t('finance.oneTime');
      case 'salaries': return '👤 ' + t('finance.salariesTab');
      case 'ads': return '📣 Ads';
      case 'software': return '🖥️ Software';
      case 'office': return '🏢 Office';
      case 'freelancer': return '🧑‍💻 Freelancer';
      default: return '📦 ' + (cat.charAt(0).toUpperCase() + cat.slice(1));
    }
  };

  const filteredLineItems = useMemo(() => {
    return reportLineItems.filter(item => {
      // 1. Filter by category checkbox
      if (!reportSelectedCategories.includes(item.category)) return false;

      // 2. Filter by search query (case insensitive)
      if (reportSearchQuery) {
        const query = reportSearchQuery.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(query);
        const notesMatch = item.notes && item.notes.toLowerCase().includes(query);
        if (!nameMatch && !notesMatch) return false;
      }

      return true;
    });
  }, [reportLineItems, reportSelectedCategories, reportSearchQuery]);

  const reportKPIs = useMemo(() => {
    let income = 0;
    let expensesSum = 0;

    filteredLineItems.forEach(item => {
      if (item.type === 'income') {
        income += item.amount;
      } else {
        expensesSum += item.amount;
      }
    });

    const netProfit = income - expensesSum;
    const margin = income > 0 ? Math.round((netProfit / income) * 1000) / 10 : 0;

    return { income, expensesSum, netProfit, margin };
  }, [filteredLineItems]);

  const renderReportTab = () => {
    const categoriesList = [
      { key: 'recurring_contracts', label: '🔄 ' + t('finance.recurring') },
      { key: 'one_time_contracts', label: '💳 ' + t('finance.oneTime') },
      { key: 'salaries', label: '👤 ' + t('finance.salariesTab') },
      { key: 'ads', label: '📣 Ads Spend' },
      { key: 'software', label: '🖥️ Software' },
      { key: 'office', label: '🏢 Office' },
      { key: 'freelancer', label: '🧑‍💻 Freelancer' },
      { key: 'other', label: '📦 Other' }
    ];

    const toggleCategory = (key: string) => {
      setReportSelectedCategories(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
    };

    const toggleAllCategories = () => {
      if (reportSelectedCategories.length === categoriesList.length) {
        setReportSelectedCategories([]);
      } else {
        setReportSelectedCategories(categoriesList.map(c => c.key));
      }
    };

    const exportToExcel = () => {
      let csvContent = '\uFEFF'; // UTF-8 BOM
      
      // Title & Date window
      csvContent += `"${t('finance.reportTitle')}"\n`;
      csvContent += `"${t('team.startDate')}: ${reportStartDate} | ${t('team.endDate')}: ${reportEndDate}"\n\n`;
      
      // KPIs Summaries
      csvContent += `"${t('finance.income')}","${formatCurrency(reportKPIs.income, locale)}"\n`;
      csvContent += `"${t('finance.expense')}","${formatCurrency(reportKPIs.expensesSum, locale)}"\n`;
      csvContent += `"${t('finance.netProfit')}","${formatCurrency(reportKPIs.netProfit, locale)}"\n`;
      csvContent += `"${t('finance.margin')}","${reportKPIs.margin}%"\n\n`;
      
      // Table Headers
      csvContent += `"${t('finance.date')}","${t('finance.description')}","${t('finance.category')}","${t('finance.type')}","${t('finance.status')}","${t('finance.amount')}"\n`;
      
      // Table Rows
      filteredLineItems.forEach(item => {
        const dateStr = formatDate(item.date, locale);
        const nameStr = item.name.replace(/"/g, '""');
        const notesStr = item.notes ? ` - ${item.notes.replace(/"/g, '""')}` : '';
        const descStr = `${nameStr}${notesStr}`;
        const catLabel = getCategoryLabel(item.category);
        const typeStr = item.type === 'income' ? t('finance.income') : t('finance.expense');
        const statusStr = item.status === 'paid' ? t('finance.paid') : item.status === 'active' ? t('clients.active') : t('finance.unpaid');
        const amtStr = `${item.type === 'income' ? '+' : '-'}${item.amount}`;
        
        csvContent += `"${dateStr}","${descStr}","${catLabel}","${typeStr}","${statusStr}","${amtStr}"\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `financial_report_${reportStartDate}_to_${reportEndDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Print Layout Override Styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #print-report-area, #print-report-area * {
              visibility: visible;
            }
            #print-report-area {
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

        {/* Filters Toolbar */}
        <div className="no-print" style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: 20,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          {/* Left: Date ranges */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {t('team.startDate')}
              </label>
              <input
                type="date"
                className="form-input"
                value={reportStartDate}
                onChange={e => setReportStartDate(e.target.value)}
                style={{ marginBottom: 0, padding: '6px 12px', fontSize: '0.875rem' }}
              />
            </div>
            <span style={{ alignSelf: 'flex-end', paddingBottom: 10, color: 'var(--color-text-muted)' }}>—</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {t('team.endDate')}
              </label>
              <input
                type="date"
                className="form-input"
                value={reportEndDate}
                onChange={e => setReportEndDate(e.target.value)}
                style={{ marginBottom: 0, padding: '6px 12px', fontSize: '0.875rem' }}
              />
            </div>
          </div>

          {/* Middle: Category Selector Dropdown & Search */}
          <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
            {/* Custom Multi-select Dropdown */}
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                {t('finance.includeExcludeCategories')}
              </label>
              <button
                type="button"
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                style={{
                  width: '100%',
                  textAlign: 'start',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  {reportSelectedCategories.length === categoriesList.length
                    ? t('finance.allCategoriesSelected')
                    : t('finance.categoriesSelected', { count: reportSelectedCategories.length })}
                </span>
                <span>{showCategoryDropdown ? '▲' : '▼'}</span>
              </button>

              {showCategoryDropdown && (
                <>
                  <div
                    onClick={() => setShowCategoryDropdown(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    marginTop: 6,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    maxHeight: 240,
                    overflowY: 'auto',
                    padding: 8,
                  }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      borderBottom: '1px solid var(--color-border)',
                      marginBottom: 6,
                    }}>
                      <input
                        type="checkbox"
                        checked={reportSelectedCategories.length === categoriesList.length}
                        onChange={toggleAllCategories}
                      />
                      {t('finance.allCategories')}
                    </label>
                    {categoriesList.map(c => (
                      <label
                        key={c.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          borderRadius: 'var(--radius-sm)',
                          transition: 'background 0.2s',
                        }}
                        className="hover:bg-muted/10"
                      >
                        <input
                          type="checkbox"
                          checked={reportSelectedCategories.includes(c.key)}
                          onChange={() => toggleCategory(c.key)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Text Search */}
            <div style={{ flex: 1.5, minWidth: 220, position: 'relative' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                {t('finance.searchTransactions')}
              </label>
              <input
                type="text"
                placeholder={t('finance.searchTransactions')}
                value={reportSearchQuery}
                onChange={e => setReportSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  fontSize: '0.875rem',
                  marginBottom: 0
                }}
              />
            </div>
          </div>

          {/* Right: Export Excel Button */}
          <button
            onClick={exportToExcel}
            style={{
              alignSelf: 'flex-end',
              height: 38,
              padding: '0 16px',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'background-color 0.2s',
            }}
          >
            📊 {t('finance.exportExcel')}
          </button>
        </div>

        {/* Report Output Area (Targeted by CSS print rule) */}
        {reportLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div id="print-report-area" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Report Header for printing */}
            <div style={{ borderBottom: '2px solid var(--color-border)', paddingBottom: 12, marginBottom: 8 }} className="text-start">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                {t('finance.reportTitle')}
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                {t('team.startDate')}: <strong>{formatDate(reportStartDate, locale)}</strong> | {t('team.endDate')}: <strong>{formatDate(reportEndDate, locale)}</strong>
              </p>
            </div>

            {/* KPI Overview Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16
            }}>
              {/* Income */}
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
                boxShadow: 'var(--shadow-sm)',
                textAlign: 'start'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600 }}>
                  <span>{t('finance.income')}</span>
                  <span style={{ fontSize: '1.2rem' }}>💰</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a', marginTop: 8, fontFamily: 'monospace' }}>
                  {formatCurrency(reportKPIs.income, locale)}
                </div>
              </div>

              {/* Expense */}
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
                boxShadow: 'var(--shadow-sm)',
                textAlign: 'start'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600 }}>
                  <span>{t('finance.expense')}</span>
                  <span style={{ fontSize: '1.2rem' }}>💸</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#e11d48', marginTop: 8, fontFamily: 'monospace' }}>
                  {formatCurrency(reportKPIs.expensesSum, locale)}
                </div>
              </div>

              {/* Net Profit */}
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
                boxShadow: 'var(--shadow-sm)',
                textAlign: 'start'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600 }}>
                  <span>{t('finance.netProfit')}</span>
                  <span style={{ fontSize: '1.2rem' }}>📈</span>
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: reportKPIs.netProfit >= 0 ? 'var(--color-primary)' : '#e11d48',
                  marginTop: 8,
                  fontFamily: 'monospace'
                }}>
                  {formatCurrency(reportKPIs.netProfit, locale)}
                </div>
              </div>

              {/* Margin */}
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
                boxShadow: 'var(--shadow-sm)',
                textAlign: 'start'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 600 }}>
                  <span>{t('finance.margin')}</span>
                  <span style={{ fontSize: '1.2rem' }}>📊</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: reportKPIs.margin >= 0 ? '#16a34a' : '#e11d48', marginTop: 8, fontFamily: 'monospace' }}>
                  {reportKPIs.margin}%
                </div>
              </div>
            </div>

            {/* Ledger Table */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, textAlign: 'start' }}>
                📄 {t('finance.transactionLedger')} ({filteredLineItems.length})
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', textAlign: 'start' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'start', fontWeight: 600 }}>{t('finance.date')}</th>
                      <th style={{ padding: '10px 12px', textAlign: 'start', fontWeight: 600 }}>{t('finance.description')}</th>
                      <th style={{ padding: '10px 12px', textAlign: 'start', fontWeight: 600 }}>{t('finance.category')}</th>
                      <th style={{ padding: '10px 12px', textAlign: 'start', fontWeight: 600 }}>{t('finance.type')}</th>
                      <th style={{ padding: '10px 12px', textAlign: 'start', fontWeight: 600 }}>{t('finance.status')}</th>
                      <th style={{ padding: '10px 12px', textAlign: 'end', fontWeight: 600 }}>{t('finance.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLineItems.map(item => (
                      <tr key={item.id} style={{ transition: 'background 0.2s' }} className="hover:bg-muted/5">
                        <td style={{ padding: '12px 12px', textAlign: 'start', color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                          {formatDate(item.date, locale)}
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'start', fontWeight: 600 }}>
                          {item.name}
                          {item.notes && (
                            <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-text-muted)', marginTop: 2 }}>
                              ℹ️ {item.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'start' }}>
                          <span style={{ fontSize: '0.8125rem' }}>
                            {getCategoryLabel(item.category)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'start' }}>
                          <span style={{
                            display: 'inline-flex',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: item.type === 'income' ? '#f0fdf4' : '#fff1f2',
                            color: item.type === 'income' ? '#15803d' : '#e11d48'
                          }}>
                            {item.type === 'income' ? t('finance.income') : t('finance.expense')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'start' }}>
                          <span style={{
                            display: 'inline-flex',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor:
                              item.status === 'paid' ? '#f0fdf4' :
                              item.status === 'active' ? '#eff6ff' : '#fff7ed',
                            color:
                              item.status === 'paid' ? '#15803d' :
                              item.status === 'active' ? '#1d4ed8' : '#c2410c',
                            border: `1px solid ${
                              item.status === 'paid' ? '#bbf7d0' :
                              item.status === 'active' ? '#bfdbfe' : '#ffedd5'
                            }`
                          }}>
                            {item.status === 'paid' ? t('finance.paid') :
                             item.status === 'active' ? t('clients.active') : t('finance.unpaid')}
                          </span>
                        </td>
                        <td style={{
                          padding: '12px 12px',
                          textAlign: 'end',
                          fontWeight: 700,
                          color: item.type === 'income' ? '#16a34a' : '#e11d48',
                          fontFamily: 'monospace'
                        }}>
                          {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, locale)}
                        </td>
                      </tr>
                    ))}
                    {filteredLineItems.length === 0 && (
                      <tr style={{ background: 'transparent' }}>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
                          {t('finance.noTransactions')}
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
    if (user?.role === 'owner' || user?.role === 'sales') {
      loadData();
    }
  }, [user]);

  if (user?.role !== 'owner' && user?.role !== 'sales') return null;

  const resetProjectForm = (project?: Project) => {
    if (project) {
      setProjectForm({
        client_id: project.client_id,
        name: project.name,
        description: project.description || '',
        status: project.status,
        budget: project.budget.toString(),
        start_date: project.start_date || '',
        end_date: project.end_date || '',
      });
      setSelectedProject(project);
      setModalMode('edit');
    } else {
      setProjectForm({
        client_id: clients.filter(c => c.pipeline_stage === 'won')[0]?.id || '',
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

  const resetContractForm = (contract?: Contract) => {
    if (contract) {
      setContractForm({
        client_id: contract.client_id,
        project_id: contract.project_id || '',
        name: contract.name,
        amount: contract.amount.toString(),
        is_recurring: contract.is_recurring,
        billing_cycle: contract.billing_cycle,
        status: contract.status,
        start_date: contract.start_date || '',
        renewal_date: contract.renewal_date || '',
      });
      setSelectedContract(contract);
      setModalMode('edit');

      if (!contract.is_recurring && contract.installments && contract.installments.length > 0) {
        setInstallmentsEnabled(true);
        setInstallmentRows(
          contract.installments.map(inst => ({
            id: inst.id,
            amount: inst.amount.toString(),
            due_date: inst.due_date ? inst.due_date.split('T')[0] : '',
            note: inst.note || '',
            paid: inst.paid
          }))
        );
      } else {
        setInstallmentsEnabled(false);
        setInstallmentRows([{ amount: '', due_date: '', note: '' }]);
      }
    } else {
      setContractForm({
        client_id: clients.filter(c => c.pipeline_stage === 'won')[0]?.id || '',
        project_id: '',
        name: '',
        amount: '',
        is_recurring: true,
        billing_cycle: 'monthly',
        status: 'active',
        start_date: '',
        renewal_date: '',
      });
      setSelectedContract(null);
      setModalMode('create');
      setInstallmentsEnabled(false);
      setInstallmentRows([{ amount: '', due_date: '', note: '' }]);
    }
    setErrorMsg('');
  };

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

  const handleContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractForm.name || !contractForm.client_id || !contractForm.amount) {
      setErrorMsg('Contract Name, Client, and Amount are required');
      return;
    }
    if (contractForm.is_recurring && !contractForm.billing_cycle) {
      setErrorMsg('Please select a Billing Cycle for a recurring contract');
      return;
    }

    // Installments validation
    let finalInstallments: any[] | undefined = undefined;
    if (!contractForm.is_recurring && installmentsEnabled) {
      if (installmentRows.length === 0) {
        setErrorMsg('Please add at least one installment row or turn off installments');
        return;
      }
      
      let sum = 0;
      for (let i = 0; i < installmentRows.length; i++) {
        const row = installmentRows[i];
        if (!row.amount || isNaN(Number(row.amount)) || Number(row.amount) <= 0) {
          setErrorMsg(`Please specify a valid positive amount for installment #${i + 1}`);
          return;
        }
        if (!row.due_date) {
          setErrorMsg(`Please select a due date for installment #${i + 1}`);
          return;
        }
        sum += Number(row.amount);
      }
      
      // Compare sums (rounded to 2 decimal places to avoid floating point issues)
      if (Math.round(sum * 100) !== Math.round(Number(contractForm.amount) * 100)) {
        setErrorMsg(`The sum of installments ($${sum}) must equal the total contract amount ($${contractForm.amount})`);
        return;
      }
      
      finalInstallments = installmentRows.map(row => ({
        id: row.id,
        amount: Number(row.amount),
        due_date: row.due_date,
        note: row.note || null,
        paid: row.paid || false
      }));
    }

    setSubmitting(true);
    try {
      const data = {
        ...contractForm,
        project_id: contractForm.project_id || undefined,
        amount: Number(contractForm.amount),
        billing_cycle: contractForm.is_recurring ? contractForm.billing_cycle : 'one_time',
        start_date: contractForm.start_date || undefined,
        renewal_date: contractForm.is_recurring ? (contractForm.renewal_date || undefined) : undefined,
        installments: finalInstallments,
      };
      if (modalMode === 'create') {
        await contractsApi.create(data);
      } else if (selectedContract) {
        await contractsApi.update(selectedContract.id, data);
      }
      setContractModalOpen(false);
      loadData(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(t('finance.deleteProjectConfirm').replace('{name}', name))) return;
    try {
      await projectsApi.delete(id);
      loadData(true);
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  const handleDeleteContract = async (id: string, name: string) => {
    if (!confirm(t('finance.deleteContractConfirm').replace('{name}', name))) return;
    try {
      await contractsApi.delete(id);
      loadData(true);
    } catch (err) {
      alert('Failed to delete contract');
    }
  };

  const handleToggleInstallmentPaid = async (contractId: string, installmentId: string, paid: boolean) => {
    // Optimistic update
    setContracts(prev => prev.map(c => {
      if (c.id === contractId && c.installments) {
        return {
          ...c,
          installments: c.installments.map(inst =>
            inst.id === installmentId ? { ...inst, paid } : inst
          )
        };
      }
      return c;
    }));

    try {
      await contractsApi.markInstallmentPaid(contractId, installmentId, paid);
      loadData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to update installment status');
      loadData(true);
    }
  };

  // Expenses CRUD handlers
  const resetExpenseForm = (expense?: Expense) => {
    if (expense) {
      setExpenseForm({
        title: expense.title,
        amount: expense.amount.toString(),
        category: expense.category,
        date: expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
        note: expense.note || '',
        is_recurring: expense.is_recurring,
        recurrence: expense.recurrence || 'monthly',
      });
      setSelectedExpense(expense);
      setModalMode('edit');
    } else {
      setExpenseForm({
        title: '',
        amount: '',
        category: 'software',
        date: new Date().toISOString().split('T')[0],
        note: '',
        is_recurring: false,
        recurrence: 'monthly',
      });
      setSelectedExpense(null);
      setModalMode('create');
    }
    setErrorMsg('');
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount || !expenseForm.date) {
      setErrorMsg('Title, Amount, and Date are required');
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        ...expenseForm,
        amount: Number(expenseForm.amount),
        recurrence: expenseForm.is_recurring ? expenseForm.recurrence : undefined,
      };
      if (modalMode === 'create') {
        await expensesApi.create(data);
      } else if (selectedExpense) {
        await expensesApi.update(selectedExpense.id, data);
      }
      setExpenseModalOpen(false);
      loadData(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, title: string) => {
    if (!confirm(t('finance.deleteExpenseConfirm').replace('{title}', title))) return;
    try {
      await expensesApi.delete(id);
      loadData(true);
    } catch (err) {
      alert('Failed to delete expense');
    }
  };

  // Salaries CRUD handlers
  const resetSalaryForm = (salary?: Salary) => {
    if (salary) {
      const derivedDate = salary.paid_date
        ? salary.paid_date.split('T')[0]
        : salary.month
          ? salary.month.substring(0, 10)
          : new Date().toISOString().split('T')[0];
      setSalaryForm({
        user_id: salary.user_id,
        amount: salary.amount.toString(),
        paid: salary.paid,
        paid_date: derivedDate,
        is_recurring: salary.is_recurring ?? true,
        recurrence: salary.recurrence || 'monthly',
        note: salary.note || '',
      });
      setSalaryInstallmentRows(
        salary.installments && salary.installments.length > 0
          ? salary.installments.map(i => ({ id: i.id, amount: i.amount.toString(), due_date: i.due_date ? i.due_date.split('T')[0] : '', paid: i.paid, note: i.note || '' }))
          : [{ amount: '', due_date: '', paid: false, note: '' }]
      );
      setSelectedSalary(salary);
      setModalMode('edit');
    } else {
      const defaultDate = expenseMonthFilter
        ? `${expenseMonthFilter}-01`
        : new Date().toISOString().split('T')[0];
      setSalaryForm({
        user_id: usersList[0]?.id || '',
        amount: '',
        paid: false,
        paid_date: defaultDate,
        is_recurring: true,
        recurrence: 'monthly',
        note: '',
      });
      setSalaryInstallmentRows([{ amount: '', due_date: '', paid: false, note: '' }]);
      setSelectedSalary(null);
      setModalMode('create');
    }
    setErrorMsg('');
  };

  const handleSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryForm.user_id || !salaryForm.amount || !salaryForm.paid_date) {
      setErrorMsg('Team Member, Amount, and Payment Date are required');
      return;
    }
    const monthStr = salaryForm.paid_date.substring(0, 7) + '-01';
    if (!salaryForm.is_recurring) {
      const totalInst = salaryInstallmentRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const totalAmt = Number(salaryForm.amount);
      if (salaryInstallmentRows.length > 0 && salaryInstallmentRows[0].amount) {
        if (Math.round(totalInst * 100) !== Math.round(totalAmt * 100)) {
          setErrorMsg(`Installments sum ($${totalInst}) must equal the total amount ($${totalAmt})`);
          return;
        }
        for (let i = 0; i < salaryInstallmentRows.length; i++) {
          if (!salaryInstallmentRows[i].amount || !salaryInstallmentRows[i].due_date) {
            setErrorMsg(`Installment #${i + 1} must have an amount and due date`);
            return;
          }
        }
      }
    }
    setSubmitting(true);
    try {
      const installments = !salaryForm.is_recurring && salaryInstallmentRows[0]?.amount
        ? salaryInstallmentRows.map(r => ({ id: r.id, amount: Number(r.amount), due_date: r.due_date, paid: r.paid, note: r.note || null }))
        : undefined;
      const data = {
        user_id: salaryForm.user_id,
        amount: Number(salaryForm.amount),
        month: monthStr,
        paid: salaryForm.paid,
        paid_date: salaryForm.paid_date,
        is_recurring: salaryForm.is_recurring,
        recurrence: salaryForm.recurrence,
        note: salaryForm.note || null,
        installments,
      };
      if (modalMode === 'create') {
        await salariesApi.create(data);
      } else if (selectedSalary) {
        await salariesApi.update(selectedSalary.id, data);
      }
      setSalaryModalOpen(false);
      loadData(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSalaryPaid = async (salaryId: string, paid: boolean) => {
    setSalaries(prev => prev.map(s => s.id === salaryId ? { ...s, paid } : s));
    try {
      await salariesApi.update(salaryId, { paid });
      contractsApi.stats().then(res => { if (res.stats) setStats(res.stats); });
    } catch (err: any) {
      alert(err.message || 'Failed to update salary status');
      loadData(true);
    }
  };

  const handleToggleSalaryInstallmentPaid = async (salaryId: string, instId: string, paid: boolean) => {
    setSalaries(prev => prev.map(s => s.id === salaryId && s.installments
      ? { ...s, installments: s.installments.map(i => i.id === instId ? { ...i, paid } : i) }
      : s
    ));
    try {
      await salariesApi.markInstallmentPaid(salaryId, instId, paid);
    } catch (err: any) {
      alert(err.message || 'Failed to update installment');
      loadData(true);
    }
  };

  const handleDeleteSalary = async (id: string, name: string) => {
    if (!confirm(t('finance.deleteSalaryConfirm').replace('{name}', name))) return;
    try {
      await salariesApi.delete(id);
      loadData(true);
    } catch (err) {
      alert('Failed to delete salary record');
    }
  };

  const getCycleLabel = (cycle: string) => {
    switch (cycle) {
      case 'monthly': return t('finance.monthly');
      case 'quarterly': return t('finance.quarterly');
      case 'yearly': return t('finance.yearly');
      default: return t('finance.oneTime');
    }
  };

  const filteredProjectsList = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.client?.name && p.client.name.toLowerCase().includes(projectSearch.toLowerCase())) ||
    (p.client?.company && p.client.company.toLowerCase().includes(projectSearch.toLowerCase()))
  );

  const filteredContractsList = contracts.filter(c =>
    c.name.toLowerCase().includes(contractSearch.toLowerCase()) ||
    (c.client?.name && c.client.name.toLowerCase().includes(contractSearch.toLowerCase()))
  );

  // Calculated arrays
  const activeContractsList = contracts.filter(c => c.status === 'active');
  const alertRenewals = activeContractsList
    .map(c => ({ contract: c, status: getRenewalStatus(c.renewal_date, c.status, t) }))
    .filter(item => item.status.isAlert)
    .sort((a, b) => {
      if (!a.contract.renewal_date) return 1;
      if (!b.contract.renewal_date) return -1;
      return new Date(a.contract.renewal_date).getTime() - new Date(b.contract.renewal_date).getTime();
    });

  const renderAnalyticsTab = () => {
    if (analyticsLoading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!analyticsData) {
      return (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--color-surface)',
          border: '1.5px dashed var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--color-text-muted)',
          margin: '20px 0'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📊</div>
          <h3>{t('finance.noFinancialData')}</h3>
          <p style={{ marginTop: 6, fontSize: '0.875rem' }}>{t('finance.addDataHint')}</p>
        </div>
      );
    }

    const { monthly, projections, ltmRevenue, ltmExpenses, ltmNetProfit, ltmMargin } = filteredData;

    // 1. Donut Chart Calculations
    const donutCategories = analyticsData.expenseCategoryList
      .map(cat => {
        let label = cat.key.toUpperCase();
        let color = '#94a3b8';
        let emoji = '📦';
        if (cat.key === 'salary' || cat.key === 'salaries') { label = t('finance.salariesTab').replace('💸 ', ''); color = '#6366f1'; emoji = '👤'; }
        else if (cat.key === 'ads') { label = t('contentType.story'); color = '#f97316'; emoji = '📣'; }
        else if (cat.key === 'software') { label = 'Software'; color = '#3b82f6'; emoji = '🖥️'; }
        else if (cat.key === 'office') { label = 'Office'; color = '#64748b'; emoji = '🏢'; }
        else if (cat.key === 'freelancer') { label = 'Freelancers'; color = '#8b5cf6'; emoji = '🧑‍💻'; }
        else { label = cat.key.charAt(0).toUpperCase() + cat.key.slice(1); color = '#10b981'; emoji = '📦'; }

        return { key: cat.key, label, value: cat.value, color, emoji };
      })
      .filter(c => c.value > 0);

    const totalExpForDonut = donutCategories.reduce((sum, c) => sum + c.value, 0);

    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let cumulativePercentage = 0;

    const donutSlices = donutCategories.map(cat => {
      const percentage = totalExpForDonut > 0 ? cat.value / totalExpForDonut : 0;
      const strokeLength = percentage * circumference;
      const strokeOffset = circumference - (cumulativePercentage * circumference);
      cumulativePercentage += percentage;
      return { ...cat, percentage, strokeLength, strokeOffset };
    });

    // 2. Bar Chart Math
    const barChartHeight = 220;
    const barChartWidth = 600;
    const paddingLeft = 55;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 30;

    const maxVal = Math.max(
      ...monthly.map(d => Math.max(d.computedRevenue, d.computedExpenses, 1000))
    ) * 1.15;

    const getX = (idx: number) => paddingLeft + (idx * (barChartWidth - paddingLeft - paddingRight) / 11);
    const getY = (val: number) => barChartHeight - paddingBottom - (val * (barChartHeight - paddingTop - paddingBottom) / maxVal);

    // 4. Receivables Aging list
    const overdueList = [
      { key: 'overdue90Plus', label: '💀 90+ ' + t('common.overdue'), color: '#e11d48', bg: '#fff1f2', items: analyticsData.receivablesAging.overdue90Plus },
      { key: 'overdue61_90', label: '🚨 61-90 ' + t('common.overdue'), color: '#ea580c', bg: '#fff7ed', items: analyticsData.receivablesAging.overdue61_90 },
      { key: 'overdue31_60', label: '🔥 31-60 ' + t('common.overdue'), color: '#d97706', bg: '#fef3c7', items: analyticsData.receivablesAging.overdue31_60 },
      { key: 'overdue1_30', label: '⚠️ 1-30 ' + t('common.overdue'), color: '#4f46e5', bg: '#ede9fe', items: analyticsData.receivablesAging.overdue1_30 },
      { key: 'current', label: '📅 ' + t('finance.renewalDate'), color: '#16a34a', bg: '#f0fdf4', items: analyticsData.receivablesAging.current }
    ];

    const hasAgingRecords = overdueList.some(list => list.items.length > 0);

    const monthLabelFull = (m: string) => {
      const [y, mo] = m.split('-');
      return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="text-start">

        {/* 📊 KPI BLOCK */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <div className="stat-card" style={{ '--stat-accent': '#6366f1', '--stat-icon-bg': '#ede9fe' } as React.CSSProperties}>
            <div className="stat-label">{t('finance.monthlyRevenue')}</div>
            <div className="stat-value">{formatCurrency(analyticsData.kpis.mrr, locale)}</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': '#10b981', '--stat-icon-bg': '#e6f4ea' } as React.CSSProperties}>
            <div className="stat-label">{t('finance.ltmRevenue')}</div>
            <div className="stat-value">{formatCurrency(ltmRevenue, locale)}</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': '#ef4444', '--stat-icon-bg': '#fce8e6' } as React.CSSProperties}>
            <div className="stat-label">{t('finance.ltmExpenses')}</div>
            <div className="stat-value">{formatCurrency(ltmExpenses, locale)}</div>
          </div>
          <div className="stat-card" style={{
            '--stat-accent': ltmNetProfit >= 0 ? '#10b981' : '#ef4444',
            '--stat-icon-bg': ltmNetProfit >= 0 ? '#e6f4ea' : '#fce8e6'
          } as React.CSSProperties}>
            <div className="stat-label">{t('finance.ltmNetProfit')}</div>
            <div className="stat-value" style={{ color: ltmNetProfit >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(ltmNetProfit, locale)}</div>
          </div>
          <div className="stat-card" style={{
            '--stat-accent': ltmMargin >= 25 ? '#10b981' : ltmMargin >= 10 ? '#f59e0b' : '#ef4444',
            '--stat-icon-bg': ltmMargin >= 25 ? '#e6f4ea' : ltmMargin >= 10 ? '#fffbeb' : '#fce8e6'
          } as React.CSSProperties}>
            <div className="stat-label">{t('finance.ltmMargin')}</div>
            <div className="stat-value">{ltmMargin.toFixed(1)}%</div>
          </div>
        </div>

        {/* 📈 MAIN CHARTS SECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }} className="grid-md-2">
          
          {/* BAR CHART: 12-Month History */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            boxShadow: 'var(--shadow-sm)',
            position: 'relative'
          }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 4 }}>{t('finance.revenueVsExpenses')}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 20 }}>{t('finance.projections')}</p>

            <div style={{ position: 'relative' }}>
              <svg viewBox={`0 0 ${barChartWidth} ${barChartHeight}`} width="100%" height="auto">
                <defs>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#e11d48" />
                  </linearGradient>
                </defs>

                {/* Y-axis Ticks & Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
                  const tickVal = maxVal * tick;
                  const y = getY(tickVal);
                  return (
                    <g key={i}>
                      <line x1={paddingLeft} y1={y} x2={barChartWidth - paddingRight} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                      <text x={paddingLeft - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8" fontWeight="600">
                        {formatCurrency(tickVal, locale)}
                      </text>
                    </g>
                  );
                })}

                {/* Monthly Bars & Profit Dots */}
                {monthly.map((d, i) => {
                  const x = getX(i);
                  const revY = getY(d.computedRevenue);
                  const expY = getY(d.computedExpenses);
                  const zeroY = getY(0);

                  const revHeight = Math.max(zeroY - revY, 0);
                  const expHeight = Math.max(zeroY - expY, 0);

                  return (
                    <g key={i}>
                      {/* Highlight Hover Column */}
                      {hoveredBarIdx === i && (
                        <rect x={x - 18} y={paddingTop} width={36} height={barChartHeight - paddingTop - paddingBottom} fill="#f1f5f9" opacity="0.5" rx={4} />
                      )}

                      {/* Revenue Bar */}
                      {revHeight > 0 && (
                        <rect x={x - 10} y={revY} width={8} height={revHeight} rx={2} fill="url(#greenGrad)" style={{ transition: 'all 0.3s ease-out' }} />
                      )}

                      {/* Expense Bar */}
                      {expHeight > 0 && (
                        <rect x={x + 2} y={expY} width={8} height={expHeight} rx={2} fill="url(#redGrad)" style={{ transition: 'all 0.3s ease-out' }} />
                      )}

                      {/* Profit Dot */}
                      <circle
                         cx={x}
                         cy={getY(d.computedProfit)}
                         r={hoveredBarIdx === i ? 6 : 4}
                         fill={d.computedProfit >= 0 ? '#10b981' : '#ef4444'}
                         stroke="#fff"
                         strokeWidth="1.5"
                         style={{ transition: 'all 0.2s' }}
                      />
                    </g>
                  );
                })}

                {/* Profit Line */}
                {monthly.length > 1 && (
                  <path
                    d={`M ${monthly.map((d, i) => `${getX(i)} ${getY(d.computedProfit)}`).join(' L ')}`}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    strokeDasharray="2 2"
                    style={{ transition: 'all 0.3s ease-out' }}
                  />
                )}

                {/* X-axis labels */}
                {monthly.map((d, i) => {
                  const x = getX(i);
                  const label = (() => {
                    const [year, month] = d.month.split('-');
                    const date = new Date(Number(year), Number(month) - 1, 1);
                    return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short' });
                  })();

                  return (
                    <text key={i} x={x} y={barChartHeight - 10} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">
                      {label}
                    </text>
                  );
                })}
              </svg>

              {/* Tooltip Overlay */}
              {hoveredBarIdx !== null && monthly[hoveredBarIdx] && (
                <div style={{
                  position: 'absolute',
                  top: 10,
                  left: Math.min(getX(hoveredBarIdx) + 15, barChartWidth - 170),
                  background: 'rgba(15, 23, 42, 0.95)',
                  color: '#fff',
                  padding: '10px 14px',
                  borderRadius: 10,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  pointerEvents: 'none',
                  zIndex: 10,
                  fontSize: '0.75rem',
                  minWidth: 155,
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ fontWeight: 800, marginBottom: 4, color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 4 }}>
                    {monthLabelFull(monthly[hoveredBarIdx].month)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('finance.monthlyRevenue')}:</span>
                    <span style={{ fontWeight: 800, color: '#34d399' }}>{formatCurrency(monthly[hoveredBarIdx].computedRevenue, locale)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('finance.expenses')}:</span>
                    <span style={{ fontWeight: 800, color: '#f87171' }}>{formatCurrency(monthly[hoveredBarIdx].computedExpenses, locale)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4, paddingTop: 4 }}>
                    <span>{t('finance.netProfit')}:</span>
                    <span style={{ fontWeight: 800, color: monthly[hoveredBarIdx].computedProfit >= 0 ? '#34d399' : '#f87171' }}>
                      {formatCurrency(monthly[hoveredBarIdx].computedProfit, locale)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#94a3b8' }}>
                    <span>Margin:</span>
                    <span style={{ fontWeight: 700 }}>{monthly[hoveredBarIdx].computedMargin}%</span>
                  </div>
                </div>
              )}

              {/* Invisible Hover Selectors */}
              <div style={{ position: 'absolute', top: paddingTop, left: paddingLeft, width: barChartWidth - paddingLeft - paddingRight, height: barChartHeight - paddingTop - paddingBottom, display: 'flex' }}>
                {monthly.map((_, i) => (
                  <div
                    key={i}
                    style={{ flex: 1, cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredBarIdx(i)}
                    onMouseLeave={() => setHoveredBarIdx(null)}
                  />
                ))}
              </div>
            </div>
            
            {/* Chart Legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12, fontSize: '0.75rem', fontWeight: 700 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'url(#greenGrad)' }} />
                <span>{t('finance.monthlyRevenue')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'url(#redGrad)' }} />
                <span>{t('finance.expenses')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                <span>{t('finance.netProfit')}</span>
              </div>
            </div>
          </div>

          {/* DONUT CHART: Expense Distribution */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 4 }}>{t('finance.expenseBreakdown')}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 20 }}>{t('finance.expenseBreakdown')}</p>

            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 32 }}>
              
              {/* Donut SVG */}
              <div style={{ position: 'relative', width: 180, height: 180 }}>
                <svg viewBox="0 0 120 120" width="100%" height="100%">
                  {/* Base Circle */}
                  <circle cx="60" cy="60" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />

                  {/* Category Slices */}
                  {donutSlices.map((slice, i) => (
                    <circle
                      key={i}
                      cx="60"
                      cy="60"
                      r={radius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={hoveredDonutIdx === i ? 14 : 10}
                      strokeDasharray={`${slice.strokeLength} ${circumference - slice.strokeLength}`}
                      strokeDashoffset={slice.strokeOffset}
                      transform="rotate(-90 60 60)"
                      style={{
                        transition: 'stroke-width 0.2s, stroke-dashoffset 0.3s ease-out',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={() => setHoveredDonutIdx(i)}
                      onMouseLeave={() => setHoveredDonutIdx(null)}
                    />
                  ))}
                </svg>

                {/* Center text container */}
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  padding: 10
                }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', textAlign: 'center', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {hoveredDonutIdx !== null ? donutSlices[hoveredDonutIdx].label : t('finance.totalExpenses')}
                  </span>
                  <span style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>
                    {hoveredDonutIdx !== null 
                      ? formatCurrency(donutSlices[hoveredDonutIdx].value, locale) 
                      : formatCurrency(totalExpForDonut, locale)}
                  </span>
                  {hoveredDonutIdx !== null && (
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: donutSlices[hoveredDonutIdx].color, marginTop: 1 }}>
                      {((donutSlices[hoveredDonutIdx].percentage) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Legend List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 160 }}>
                {donutSlices.map((slice, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: hoveredDonutIdx === i ? 'var(--color-surface-2)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={() => setHoveredDonutIdx(i)}
                    onMouseLeave={() => setHoveredDonutIdx(null)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1rem' }}>{slice.emoji}</span>
                      <span style={{ fontSize: '0.78125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{slice.label}</span>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '0.78125rem', fontWeight: 800 }}>{formatCurrency(slice.value, locale)}</span>
                      <span style={{ fontSize: '0.625rem', color: slice.color, fontWeight: 700 }}>{((slice.percentage) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
                {donutSlices.length === 0 && (
                  <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '20px 0' }}>{t('finance.noFinancialData')}</div>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* 💳 RECEIVABLES AGING PANEL */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 4 }}>{t('finance.receivablesAging')}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 20 }}>{t('finance.receivablesAging')}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {hasAgingRecords ? (
              overdueList.map(list => {
                if (list.items.length === 0) return null;
                return (
                  <div key={list.key} style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      background: list.bg,
                      color: list.color,
                      padding: '10px 16px',
                      fontSize: '0.8125rem',
                      fontWeight: 800,
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--color-border)'
                    }}>
                      <span>{list.label}</span>
                      <span>{list.items.length} records</span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '8px 16px', fontSize: '0.75rem', textAlign: 'start' }}>{t('taskDetail.client')}</th>
                            <th style={{ padding: '8px 16px', fontSize: '0.75rem', textAlign: 'start' }}>{t('finance.contractName')}</th>
                            <th style={{ padding: '8px 16px', fontSize: '0.75rem', textAlign: 'start' }}>{t('finance.date')}</th>
                            <th style={{ padding: '8px 16px', fontSize: '0.75rem', textAlign: 'center' }}>{t('common.overdue')}</th>
                            <th style={{ padding: '8px 16px', fontSize: '0.75rem', textAlign: 'end' }}>{t('finance.amount')}</th>
                            <th style={{ padding: '8px 16px', fontSize: '0.75rem', textAlign: 'end' }}>{t('finance.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.items.map((record: any) => (
                            <tr key={record.installmentId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '10px 16px', fontSize: '0.8125rem', textAlign: 'start' }}>
                                <strong>{record.clientName}</strong>
                                {record.company && <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{record.company}</div>}
                              </td>
                              <td style={{ padding: '10px 16px', fontSize: '0.8125rem', textAlign: 'start' }}>{record.contractName}</td>
                              <td style={{ padding: '10px 16px', fontSize: '0.8125rem', color: '#64748b', textAlign: 'start' }}>{formatDate(record.dueDate, locale)}</td>
                              <td style={{ padding: '10px 16px', fontSize: '0.8125rem', textAlign: 'center' }}>
                                {record.daysOverdue > 0 ? (
                                  <span style={{ color: list.color, fontWeight: 700 }}>{record.daysOverdue} days</span>
                                ) : (
                                  <span style={{ color: '#16a34a', fontWeight: 600 }}>In {Math.abs(record.daysOverdue)} days</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 16px', fontSize: '0.8125rem', fontWeight: 800, textAlign: 'end', color: 'var(--color-primary)' }}>
                                {formatCurrency(record.amount, locale)}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'end' }}>
                                <button
                                  type="button"
                                  className="btn btn-outline-primary"
                                  onClick={() => handleToggleInstallmentPaid(record.contractId, record.installmentId, true)}
                                  style={{ padding: '4px 10px', fontSize: '0.6875rem', fontWeight: 700 }}
                                >
                                  {t('finance.paid')}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '40px 0',
                color: '#16a34a',
                background: '#f0fdf4',
                border: '1.5px dashed #bbf7d0',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}>
                <span style={{ fontSize: '2rem' }}>🎉</span>
                <span style={{ fontWeight: 800 }}>Receivables fully collected</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>There are no unpaid contract installments currently pending.</span>
              </div>
            )}
          </div>
        </div>

        {/* 🏆 TOP CLIENTS RANKINGS */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 4 }}>{t('finance.topClients')}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 20 }}>{t('finance.topClients')}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {analyticsData.topClients.map((client, idx) => (
              <div
                key={client.id}
                style={{
                  padding: 16,
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Ranking Medal */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  background: idx === 0 ? '#fef3c7' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#ffedd5' : 'var(--color-surface-2)',
                  color: idx === 0 ? '#b45309' : idx === 1 ? '#475569' : idx === 2 ? '#c2410c' : 'var(--color-text-secondary)',
                  flexShrink: 0
                }}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0, textAlign: 'start' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={client.name}>
                    {client.name}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {client.company}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {client.activeContractsCount} active contracts
                  </div>
                </div>

                <div style={{ textAlign: 'end', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 900, color: 'var(--color-primary)' }}>{formatCurrency(client.totalRevenue, locale)}</div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Annual Booking</div>
                </div>
              </div>
            ))}
            {analyticsData.topClients.length === 0 && (
              <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No client contracts found.</div>
            )}
          </div>
        </div>

      </div>
    );
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-container fade-in text-start" style={{ paddingBottom: 60 }}>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('finance.title')}</h1>
          <p className="page-header-subtitle">{t('finance.subtitle')}</p>
        </div>
      </div>

      {/* ── Stats Metric Cards Grid ── */}
      {stats && (
        <div className="stats-grid">
          {/* Card 1: Active Clients */}
          <div
            className="stat-card"
            style={{
              '--stat-accent': '#4f46e5',
              '--stat-icon-bg': '#ede9fe',
              transform: hoveredCard === 'clients' ? 'translateY(-2px)' : 'none',
              boxShadow: hoveredCard === 'clients' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            } as React.CSSProperties}
            onMouseEnter={() => setHoveredCard('clients')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="stat-label">{t('dashboard.totalClients')}</div>
            <div className="stat-value">{clients.filter(c => c.pipeline_stage === 'won').length}</div>
          </div>

          {/* Card 2: Active Projects */}
          <div
            className="stat-card"
            style={{
              '--stat-accent': '#3b82f6',
              '--stat-icon-bg': '#eff6ff',
              transform: hoveredCard === 'projects' ? 'translateY(-2px)' : 'none',
              boxShadow: hoveredCard === 'projects' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            } as React.CSSProperties}
            onMouseEnter={() => setHoveredCard('projects')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="stat-label">{t('finance.activeProjects')}</div>
            <div className="stat-value">{stats.activeProjects}</div>
          </div>

          {/* Card 3: Monthly Revenue */}
          <div
            className="stat-card"
            style={{
              '--stat-accent': '#16a34a',
              '--stat-icon-bg': '#f0fdf4',
              transform: hoveredCard === 'revenue' ? 'translateY(-2px)' : 'none',
              boxShadow: hoveredCard === 'revenue' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            } as React.CSSProperties}
            onMouseEnter={() => setHoveredCard('revenue')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="stat-label">{t('finance.monthlyRevenue')}</div>
            <div className="stat-value">{formatCurrency(stats.monthlyRevenue, locale)}</div>
          </div>

          {/* Card 4: Upcoming Renewals */}
          <div
            className="stat-card"
            style={{
              '--stat-accent': stats.upcomingRenewalsCount > 0 ? '#ea580c' : '#6b7280',
              '--stat-icon-bg': stats.upcomingRenewalsCount > 0 ? '#fff7ed' : '#f1f5f9',
              transform: hoveredCard === 'renewals' ? 'translateY(-2px)' : 'none',
              boxShadow: hoveredCard === 'renewals' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            } as React.CSSProperties}
            onMouseEnter={() => setHoveredCard('renewals')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="stat-label">{t('finance.upcomingRenewals')}</div>
            <div className="stat-value">{stats.upcomingRenewalsCount}</div>
          </div>

          {/* Card 5: Total Expenses */}
          <div
            className="stat-card"
            style={{
              '--stat-accent': '#ef4444',
              '--stat-icon-bg': '#fef2f2',
              transform: hoveredCard === 'expenses' ? 'translateY(-2px)' : 'none',
              boxShadow: hoveredCard === 'expenses' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            } as React.CSSProperties}
            onMouseEnter={() => setHoveredCard('expenses')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="stat-label">{t('finance.totalExpenses')}</div>
            <div className="stat-value">{formatCurrency(stats.totalExpensesThisMonth || 0, locale)}</div>
          </div>

          {/* Card 6: Net Profit */}
          <div
            className="stat-card"
            style={{
              '--stat-accent': (stats.netProfitThisMonth || 0) >= 0 ? '#16a34a' : '#ef4444',
              '--stat-icon-bg': (stats.netProfitThisMonth || 0) >= 0 ? '#f0fdf4' : '#fef2f2',
              transform: hoveredCard === 'netprofit' ? 'translateY(-2px)' : 'none',
              boxShadow: hoveredCard === 'netprofit' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            } as React.CSSProperties}
            onMouseEnter={() => setHoveredCard('netprofit')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="stat-label">{t('finance.netProfit')}</div>
            <div className="stat-value" style={{ color: (stats.netProfitThisMonth || 0) >= 0 ? '#16a34a' : '#ef4444' }}>
              {formatCurrency(stats.netProfitThisMonth || 0, locale)}
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-Tab Navigation Switcher ── */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 24,
        gap: 16,
        overflowX: 'auto',
      }}>
        {[
          { id: 'overview', label: '📊 ' + t('finance.overview') },
          { id: 'analytics', label: '📊 ' + t('finance.analytics') },
          { id: 'contracts', label: '💼 ' + t('finance.contracts') },
          { id: 'expenses', label: '💸 ' + t('finance.expenses') },
          { id: 'report', label: '📄 ' + t('finance.customReports') },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 6px',
              fontSize: '0.9375rem',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottom: activeTab === tab.id ? '3px solid var(--color-primary)' : '3px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}

      {/* 1.5 FINANCIAL ANALYTICS TAB */}
      {activeTab === 'analytics' && renderAnalyticsTab()}

      {/* CUSTOM FINANCIAL REPORT TAB */}
      {activeTab === 'report' && renderReportTab()}
      
      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }} className="grid-md-2 text-start">
          {/* Left Column: Quick lists */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Quick Clients list */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('clients.clientsList')}</h3>
                <button onClick={() => router.push('/dashboard/clients')} style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                  {t('dashboard.viewAll')}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {clients.filter(c => c.pipeline_stage === 'won').slice(0, 4).map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem' }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, textAlign: 'start' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{c.company || t('clients.privateClient')}</div>
                    </div>
                    <span className={`badge ${c.status === 'active' ? 'badge-completed' : 'badge-todo'}`} style={{ fontSize: '0.6875rem' }}>
                      {c.status === 'active' ? t('clients.active') : t('clients.inactive')}
                    </span>
                  </div>
                ))}
                {clients.filter(c => c.pipeline_stage === 'won').length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{t('clients.noClientsFound')}</div>
                )}
              </div>
            </div>

            {/* Quick Projects list */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('clients.projectsList')}</h3>
                <button onClick={() => router.push('/dashboard/clients')} style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                  {t('dashboard.viewAll')}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {projects.filter(p => p.status === 'active').slice(0, 4).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ textAlign: 'start' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{t('taskDetail.client')}: {p.client?.name}</div>
                    </div>
                    <div style={{ textAlign: 'end' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(p.budget, locale)}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{t('clients.budget')}</div>
                    </div>
                  </div>
                ))}
                {projects.filter(p => p.status === 'active').length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{t('clients.noProjects')}</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Renewals alert center */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            height: 'fit-content',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>{t('finance.renewalAlerts')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {alertRenewals.map(item => (
                <div
                  key={item.contract.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: item.status.bg,
                    border: `1px solid ${item.status.color}30`,
                    borderLeft: `4px solid ${item.status.color}`,
                    borderRight: `4px solid ${item.status.color}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'start' }}>
                      {item.contract.name}
                    </div>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: item.status.color,
                      backgroundColor: `${item.status.color}15`,
                      padding: '2px 8px',
                      borderRadius: 12,
                    }}>
                      {item.status.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    <span>{t('taskDetail.client')}: <strong>{item.contract.client?.name}</strong></span>
                    <span>{t('finance.renewalDate')}: <strong>{formatDate(item.contract.renewal_date, locale)}</strong></span>
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: item.status.color, marginTop: 4, textAlign: 'start' }}>
                    {formatCurrency(item.contract.amount, locale)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>/ {getCycleLabel(item.contract.billing_cycle)}</span>
                  </div>
                </div>
              ))}
              {alertRenewals.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 0',
                  color: 'var(--color-text-muted)',
                  border: '1.5px dashed var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>✅</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{t('finance.noAlerts')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. CONTRACTS TAB */}
      {activeTab === 'contracts' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          {/* Actions panel */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', right: 'auto' }}>🔍</span>
              <input
                type="text"
                className="form-input pl-9 pr-9"
                placeholder={t('finance.searchContracts')}
                value={contractSearch}
                onChange={e => setContractSearch(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
            <button className="btn btn-primary" onClick={() => { resetContractForm(); setContractModalOpen(true); }} disabled={clients.filter(c => c.pipeline_stage === 'won').length === 0}>
              ＋ {t('finance.addContract')}
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'start', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.contractName')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('taskDetail.client')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('taskDetail.project')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.amount')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.category')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.billingCycle')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.status')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.renewalDate')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'end' }}>{t('finance.category')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredContractsList.map(c => {
                  const ren = getRenewalStatus(c.renewal_date, c.status, t);
                  return (
                    <Fragment key={c.id}>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '16px 16px', fontWeight: 600, textAlign: 'start' }}>{c.name}</td>
                        <td style={{ padding: '16px 16px', textAlign: 'start' }}>{c.client?.name}</td>
                        <td style={{ padding: '16px 16px', color: c.project ? 'var(--color-text-primary)' : 'var(--color-text-muted)', textAlign: 'start' }}>
                          {c.project ? c.project.name : 'None / Retainer'}
                        </td>
                        <td style={{ padding: '16px 16px', fontWeight: 700, color: 'var(--color-primary)', textAlign: 'start' }}>{formatCurrency(c.amount, locale)}</td>
                        <td style={{ padding: '16px 16px', textAlign: 'start' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                              backgroundColor: c.is_recurring ? '#ede9fe' : '#f0fdf4',
                              color: c.is_recurring ? '#6d28d9' : '#15803d',
                              border: `1px solid ${c.is_recurring ? '#c4b5fd' : '#86efac'}`,
                            }}>
                              {c.is_recurring ? '🔄 ' + t('finance.recurring') : '💳 ' + t('finance.oneTime')}
                            </span>
                            {!c.is_recurring && c.installments && c.installments.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedContractId(expandedContractId === c.id ? null : c.id);
                                }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '2px 8px', borderRadius: 12, fontSize: '0.6875rem', fontWeight: 600,
                                  backgroundColor: expandedContractId === c.id ? 'var(--color-primary-light)' : 'var(--color-bg)',
                                  color: expandedContractId === c.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                  border: '1px solid var(--color-border)',
                                  cursor: 'pointer',
                                  marginTop: 2,
                                  width: 'fit-content'
                                }}
                              >
                                🗓️ {c.installments.filter(i => i.paid).length}/{c.installments.length} {t('finance.paid')} {expandedContractId === c.id ? '▲' : '▼'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '16px 16px', textAlign: 'start' }}>
                          {c.is_recurring ? getCycleLabel(c.billing_cycle) : '—'}
                        </td>
                        <td style={{ padding: '16px 16px', textAlign: 'start' }}>
                          <span className={`badge ${c.status === 'active' ? 'badge-completed' : 'badge-todo'}`}>
                            {c.status === 'active' ? t('clients.active') : c.status === 'expired' ? t('clients.inactive') : t('clients.onHold')}
                          </span>
                        </td>
                        <td style={{ padding: '16px 16px', textAlign: 'start' }}>
                          {c.is_recurring ? (
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: 12,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: ren.bg,
                              color: ren.color,
                            }}>
                              {formatDate(c.renewal_date, locale)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>N/A</span>
                          )}
                        </td>
                        <td style={{ padding: '16px 16px', textAlign: 'end' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { resetContractForm(c); setContractModalOpen(true); }}>{t('common.edit')}</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteContract(c.id, c.name)}>{t('common.delete')}</button>
                          </div>
                        </td>
                      </tr>
                      {expandedContractId === c.id && c.installments && c.installments.length > 0 && (
                        <tr style={{ background: 'var(--color-bg)' }}>
                          <td colSpan={9} style={{ padding: '12px 24px' }}>
                            <div style={{
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-md)',
                              padding: 16,
                              background: 'var(--color-surface)',
                              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                  Installment Payments Breakdown
                                </h4>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                  Total: {formatCurrency(c.amount, locale)} | Paid: <span style={{ color: '#16a34a' }}>{formatCurrency(c.installments.filter(i => i.paid).reduce((sum, inst) => sum + inst.amount, 0), locale)}</span>
                                </span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                                {c.installments.map((inst) => (
                                  <div
                                    key={inst.id}
                                    style={{
                                      border: '1px solid var(--color-border)',
                                      borderRadius: 'var(--radius-sm)',
                                      padding: 12,
                                      background: inst.paid ? '#f0fdf4' : 'var(--color-surface)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 6,
                                      transition: 'all 0.2s',
                                      borderColor: inst.paid ? '#bbf7d0' : 'var(--color-border)',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: inst.paid ? '#15803d' : 'var(--color-text-primary)' }}>
                                        {formatCurrency(inst.amount, locale)}
                                      </span>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: inst.paid ? '#15803d' : 'var(--color-text-secondary)' }}>
                                        <input
                                          type="checkbox"
                                          checked={inst.paid}
                                          onChange={(e) => handleToggleInstallmentPaid(c.id, inst.id, e.target.checked)}
                                          style={{ cursor: 'pointer' }}
                                        />
                                        {t('finance.paid')}
                                      </label>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4, textAlign: 'start' }}>
                                      <span>📅 Due:</span> {formatDate(inst.due_date, locale)}
                                    </div>
                                    {inst.note && (
                                      <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--color-text-muted)', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: 4, marginTop: 2, textAlign: 'start' }}>
                                        Note: {inst.note}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {filteredContractsList.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
                      {clients.length === 0 ? 'Create a client first before managing billing contracts.' : 'No contracts match your query.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. EXPENSES & SALARIES TAB */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Sub Tab selection */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', gap: 16 }}>
            {[
              { id: 'expenses', label: '💸 ' + t('finance.expensesTab') },
              { id: 'salaries', label: '👤 ' + t('finance.salariesTab') },
            ].map(sub => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setExpensesSubTab(sub.id as any)}
                style={{
                  padding: '10px 4px',
                  fontSize: '0.875rem',
                  fontWeight: expensesSubTab === sub.id ? 700 : 500,
                  color: expensesSubTab === sub.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  borderBottom: expensesSubTab === sub.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* Sub tab content */}
          {expensesSubTab === 'expenses' ? (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
              {/* Filter controls */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 160 }}>
                  <select
                    className="form-select"
                    value={expenseCategoryFilter}
                    onChange={e => setExpenseCategoryFilter(e.target.value)}
                    style={{ marginBottom: 0 }}
                  >
                    <option value="">{t('finance.allCategories')}</option>
                    <option value="ads">📣 AdsSpend</option>
                    <option value="software">🖥️ Software</option>
                    <option value="office">🏢 Office</option>
                    <option value="freelancer">🧑‍💻 Freelancer</option>
                    <option value="other">📦 Other</option>
                  </select>
                </div>
                <div style={{ minWidth: 140 }}>
                  <input
                    type="month"
                    className="form-input"
                    value={expenseMonthFilter}
                    onChange={e => setExpenseMonthFilter(e.target.value)}
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => { resetExpenseForm(); setExpenseModalOpen(true); }}
                >
                  ＋ {t('finance.addExpense')}
                </button>
              </div>

              {/* Summary Chips */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 20,
                background: 'var(--color-bg)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-secondary)', alignSelf: 'center', marginRight: 8, marginLeft: 8 }}>
                  Categorized Spend:
                </div>
                {[
                  { key: 'salary', label: '👤 ' + t('finance.salariesTab'), color: '#6366f1' },
                  { key: 'ads', label: '📣 Ads Spend', color: '#ea580c' },
                  { key: 'software', label: '🖥️ Software', color: '#2563eb' },
                  { key: 'office', label: '🏢 Office', color: '#475569' },
                  { key: 'freelancer', label: '🧑‍💻 Freelancers', color: '#7c3aed' },
                  { key: 'other', label: '📦 ' + t('contentType.other'), color: '#6b7280' }
                ].map(item => {
                  const total = item.key === 'salary'
                    ? (salaries.reduce((sum, s) => sum + s.amount, 0) + expenses.filter(e => e.category === 'salary').reduce((sum, e) => sum + e.amount, 0))
                    : expenses.filter(e => e.category === item.key).reduce((sum, e) => sum + e.amount, 0);
                  return (
                    <div key={item.key} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      <span style={{ color: item.color }}>●</span>
                      <span>{item.label}:</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatCurrency(total, locale)}</span>
                    </div>
                  );
                })}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--color-primary-light)',
                  border: '1px solid var(--color-primary)',
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  color: 'var(--color-primary)'
                }}>
                  <span>Total General Expenses:</span>
                  <span>{formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0), locale)}</span>
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'start' }}>Expense Details</th>
                      <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.category')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.date')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'start' }}>Payment Type</th>
                      <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.amount')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'end' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses
                      .filter(e => e.category !== 'salary')
                      .filter(e => !expenseCategoryFilter || e.category === expenseCategoryFilter)
                      .map(e => (
                        <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.2s' }}>
                          <td style={{ padding: '16px 16px', textAlign: 'start' }}>
                            <div style={{ fontWeight: 600 }}>{e.title}</div>
                            {e.note && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{e.note}</div>}
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'start' }}>
                            {e.category === 'salary' && '👤 Salary'}
                            {e.category === 'ads' && '📣 Ads'}
                            {e.category === 'software' && '🖥️ Software'}
                            {e.category === 'office' && '🏢 Office'}
                            {e.category === 'freelancer' && '🧑‍💻 Freelancer'}
                            {e.category === 'other' && '📦 Other'}
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'start' }}>{formatDate(e.date, locale)}</td>
                          <td style={{ padding: '16px 16px', textAlign: 'start' }}>
                            <span style={{
                              display: 'inline-flex',
                              padding: '2px 8px',
                              borderRadius: 10,
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              backgroundColor: e.is_recurring ? '#ede9fe' : '#f1f5f9',
                              color: e.is_recurring ? '#6d28d9' : '#475569',
                            }}>
                              {e.is_recurring ? `🔄 ${t('finance.recurring')} (${e.recurrence})` : '💳 ' + t('finance.oneTime')}
                            </span>
                          </td>
                          <td style={{ padding: '16px 16px', fontWeight: 700, color: '#ef4444', textAlign: 'start' }}>
                            -{formatCurrency(e.amount, locale)}
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'end' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => { resetExpenseForm(e); setExpenseModalOpen(true); }}>{t('common.edit')}</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteExpense(e.id, e.title)}>{t('common.delete')}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {expenses.filter(e => e.category !== 'salary').filter(e => !expenseCategoryFilter || e.category === expenseCategoryFilter).length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
                          No general expenses registered for this month.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
              {/* Salaries header/controls */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 140 }}>
                  <input
                    type="month"
                    className="form-input"
                    value={expenseMonthFilter}
                    onChange={e => setExpenseMonthFilter(e.target.value)}
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div style={{
                  display: 'flex',
                  gap: 12,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)'
                }}>
                  <div>Total Salary Cost: <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatCurrency(salaries.reduce((sum, s) => sum + s.amount, 0), locale)}</span></div>
                  <div>•</div>
                  <div>Paid: <span style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(salaries.filter(s => s.paid).reduce((sum, s) => sum + s.amount, 0), locale)}</span></div>
                  <div>•</div>
                  <div>Unpaid: <span style={{ fontWeight: 700, color: '#ea580c' }}>{formatCurrency(salaries.filter(s => !s.paid).reduce((sum, s) => sum + s.amount, 0), locale)}</span></div>
                </div>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => { resetSalaryForm(); setSalaryModalOpen(true); }}
                  disabled={usersList.length === 0}
                >
                  ＋ {t('finance.addSalary')}
                </button>
              </div>

              {/* Salaries Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.teamMember')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.amount')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'start' }}>Payment Type</th>
                      <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.paymentDate')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.status')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'start' }}>{t('finance.note')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'end' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaries.map(s => (
                      <Fragment key={s.id}>
                        <tr style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.2s' }}>
                          <td style={{ padding: '16px 16px', textAlign: 'start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {s.user?.avatar_url ? (
                                <img src={s.user.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                  {s.user?.name ? s.user.name.charAt(0).toUpperCase() : '?'}
                                </div>
                              )}
                              <div style={{ textAlign: 'start' }}>
                                <div style={{ fontWeight: 600 }}>{s.user?.name || 'Unknown User'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{s.user?.role?.replace('_', ' ') || 'member'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 16px', fontWeight: 700, textAlign: 'start' }}>
                            {formatCurrency(s.amount, locale)}
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: '0.6875rem', fontWeight: 700, backgroundColor: s.is_recurring ? '#ede9fe' : '#f0fdf4', color: s.is_recurring ? '#6d28d9' : '#15803d' }}>
                                {s.is_recurring ? `🔄 ${t('finance.recurring')} (${s.recurrence || 'monthly'})` : '💳 ' + t('finance.oneTime')}
                              </span>
                              {!s.is_recurring && s.installments && s.installments.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedSalaryId(expandedSalaryId === s.id ? null : s.id)}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: expandedSalaryId === s.id ? 'var(--color-primary-light)' : 'var(--color-bg)', color: expandedSalaryId === s.id ? 'var(--color-primary)' : 'var(--color-text-secondary)', border: '1px solid var(--color-border)', cursor: 'pointer', width: 'fit-content' }}
                                >
                                  🗓️ {s.installments.filter(i => i.paid).length}/{s.installments.length} {t('finance.paid')} {expandedSalaryId === s.id ? '▲' : '▼'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '16px 16px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', textAlign: 'start' }}>
                            {s.paid_date ? formatDate(s.paid_date, locale) : '—'}
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'start' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                              <input
                                type="checkbox"
                                checked={s.paid}
                                onChange={e => handleToggleSalaryPaid(s.id, e.target.checked)}
                                style={{ cursor: 'pointer', width: 16, height: 16 }}
                              />
                              <span style={{ color: s.paid ? '#16a34a' : '#ea580c', fontSize: '0.8125rem' }}>
                                {s.paid ? t('finance.paid') : t('finance.unpaid')}
                              </span>
                            </label>
                          </td>
                          <td style={{ padding: '16px 16px', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', textAlign: 'start' }}>
                            {s.note || '—'}
                          </td>
                          <td style={{ padding: '16px 16px', textAlign: 'end' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => { resetSalaryForm(s); setSalaryModalOpen(true); }}>{t('common.edit')}</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSalary(s.id, s.user?.name || 'this member')}>{t('common.delete')}</button>
                            </div>
                          </td>
                        </tr>
                        {expandedSalaryId === s.id && s.installments && s.installments.length > 0 && (
                          <tr style={{ background: 'var(--color-bg)' }}>
                            <td colSpan={7} style={{ padding: '12px 24px' }}>
                              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--color-surface)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>Salary Installments</h4>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                    Total: {formatCurrency(s.amount, locale)} | Paid: <span style={{ color: '#16a34a' }}>{formatCurrency(s.installments.filter(i => i.paid).reduce((sum, i) => sum + i.amount, 0), locale)}</span>
                                  </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                  {s.installments.map(inst => (
                                    <div key={inst.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 12, background: inst.paid ? '#f0fdf4' : 'var(--color-surface)', borderColor: inst.paid ? '#bbf7d0' : 'var(--color-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, color: inst.paid ? '#15803d' : 'var(--color-text-primary)' }}>{formatCurrency(inst.amount, locale)}</span>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: inst.paid ? '#15803d' : 'var(--color-text-secondary)' }}>
                                          <input type="checkbox" checked={inst.paid} onChange={e => handleToggleSalaryInstallmentPaid(s.id, inst.id, e.target.checked)} style={{ cursor: 'pointer' }} />
                                          {t('finance.paid')}
                                        </label>
                                      </div>
                                      {inst.due_date && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textAlign: 'start' }}>📅 Due: {formatDate(inst.due_date, locale)}</div>}
                                      {inst.note && <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--color-text-muted)', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: 4, textAlign: 'start' }}>Note: {inst.note}</div>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {salaries.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
                          No salary records listed for this month.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}



      {/* ── PROJECT MODAL ── */}
      <Modal isOpen={projectModalOpen} onClose={() => setProjectModalOpen(false)} title={modalMode === 'create' ? 'Create Project' : 'Edit Project'}>
        <form onSubmit={handleProjectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="text-start">
          {errorMsg && <div className="form-error" style={{ padding: 10, background: '#fff1f2', color: '#be123c', fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)' }}>{errorMsg}</div>}

          <div className="form-group text-start">
            <label className="form-label">{t('clients.selectClient')} *</label>
            <select className="form-select" value={projectForm.client_id} onChange={e => setProjectForm({ ...projectForm, client_id: e.target.value })} required>
              {clients.filter(c => c.pipeline_stage === 'won').map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="form-group text-start">
            <label className="form-label">{t('clients.projectName')} *</label>
            <input type="text" className="form-input" placeholder="e.g. Summer Q3 Campaign" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} required />
          </div>

          <div className="form-group text-start">
            <label className="form-label">{t('clients.projectDescription')}</label>
            <textarea className="form-textarea" placeholder="Brief outline of the project scope..." rows={3} value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} />
          </div>

          <div className="form-group text-start">
            <label className="form-label">{t('clients.budget')} ($) *</label>
            <input type="number" className="form-input" placeholder="e.g. 5000" value={projectForm.budget} onChange={e => setProjectForm({ ...projectForm, budget: e.target.value })} />
          </div>

          <div className="form-group text-start">
            <label className="form-label">{t('clients.statusLabel')}</label>
            <select className="form-select" value={projectForm.status} onChange={e => setProjectForm({ ...projectForm, status: e.target.value as any })}>
              <option value="planning">{t('clients.planning')}</option>
              <option value="active">{t('clients.active')}</option>
              <option value="on_hold">{t('clients.onHold')}</option>
              <option value="completed">{t('status.completed')}</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="text-start">
            <div className="form-group text-start">
              <label className="form-label">{t('clients.startDate')}</label>
              <input type="date" className="form-input" value={projectForm.start_date} onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })} />
            </div>
            <div className="form-group text-start">
              <label className="form-label">{t('clients.endDate')}</label>
              <input type="date" className="form-input" value={projectForm.end_date} onChange={e => setProjectForm({ ...projectForm, end_date: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setProjectModalOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('clients.savingProgress') : modalMode === 'create' ? t('finance.createProjectBtn') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── CONTRACT MODAL ── */}
      <Modal isOpen={contractModalOpen} onClose={() => setContractModalOpen(false)} title={modalMode === 'create' ? t('finance.createContract') : t('finance.editContract')}>
        <form onSubmit={handleContractSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="text-start">
          {errorMsg && <div className="form-error" style={{ padding: 10, background: '#fff1f2', color: '#be123c', fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)' }}>{errorMsg}</div>}

          <div className="form-group text-start">
            <label className="form-label">{t('clients.selectClient')} *</label>
            <select className="form-select" value={contractForm.client_id} onChange={e => setContractForm({ ...contractForm, client_id: e.target.value, project_id: '' })} required>
              {clients.filter(c => c.pipeline_stage === 'won').map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="form-group text-start">
            <label className="form-label">Link to Project (Optional)</label>
            <select className="form-select" value={contractForm.project_id} onChange={e => setContractForm({ ...contractForm, project_id: e.target.value })}>
              <option value="">None (General Agency Retainer)</option>
              {projects
                .filter(p => p.client_id === contractForm.client_id)
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>

          <div className="form-group text-start">
            <label className="form-label">{t('finance.contractName')} *</label>
            <input type="text" className="form-input" placeholder="e.g. SEO Monthly Optimization" value={contractForm.name} onChange={e => setContractForm({ ...contractForm, name: e.target.value })} required />
          </div>

          {/* Payment Type Toggle: Recurring vs One-Time */}
          <div className="form-group text-start">
            <label className="form-label">Payment Type *</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {[{ value: true, label: '🔄 ' + t('finance.recurring'), desc: 'Counted in MRR' }, { value: false, label: '💳 ' + t('finance.oneTime'), desc: 'Not in MRR' }].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setContractForm({ ...contractForm, is_recurring: opt.value, billing_cycle: opt.value ? 'monthly' : 'one_time' as any })}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-md)', textAlign: 'start',
                    border: `2px solid ${contractForm.is_recurring === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: contractForm.is_recurring === opt.value ? 'var(--color-primary-light)' : 'var(--color-surface)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: contractForm.is_recurring === opt.value ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Billing Cycle (if recurring) */}
          {contractForm.is_recurring && (
            <div className="form-group text-start">
              <label className="form-label">{t('finance.billingCycle')}</label>
              <select className="form-select" value={contractForm.billing_cycle} onChange={e => setContractForm({ ...contractForm, billing_cycle: e.target.value as any })}>
                <option value="monthly">{t('finance.monthly')}</option>
                <option value="quarterly">{t('finance.quarterly')}</option>
                <option value="yearly">{t('finance.yearly')}</option>
              </select>
            </div>
          )}

          {/* Contract Amount */}
          <div className="form-group text-start">
            <label className="form-label">{t('finance.amount')} ($) *</label>
            <input type="number" className="form-input" placeholder="e.g. 1500" value={contractForm.amount} onChange={e => setContractForm({ ...contractForm, amount: e.target.value })} required />
          </div>

          {/* One-Time installments support */}
          {!contractForm.is_recurring && (
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 14 }} className="text-start">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={installmentsEnabled}
                    onChange={e => setInstallmentsEnabled(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  💳 {t('finance.installments')}
                </label>
              </div>

              {installmentsEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {installmentRows.map((row, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 3 }}>
                          <input
                            type="number"
                            className="form-input"
                            placeholder="Amount ($)"
                            value={row.amount}
                            onChange={e => {
                              const newRows = [...installmentRows];
                              newRows[idx].amount = e.target.value;
                              setInstallmentRows(newRows);
                            }}
                            style={{ marginBottom: 0 }}
                            required
                          />
                        </div>
                        <div style={{ flex: 4 }}>
                          <input
                            type="date"
                            className="form-input"
                            value={row.due_date}
                            onChange={e => {
                              const newRows = [...installmentRows];
                              newRows[idx].due_date = e.target.value;
                              setInstallmentRows(newRows);
                            }}
                            style={{ marginBottom: 0 }}
                            required
                          />
                        </div>
                        <div style={{ flex: 4 }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Note (e.g. Deposit)"
                            value={row.note}
                            onChange={e => {
                              const newRows = [...installmentRows];
                              newRows[idx].note = e.target.value;
                              setInstallmentRows(newRows);
                            }}
                            style={{ marginBottom: 0 }}
                          />
                        </div>
                        {installmentRows.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => {
                              setInstallmentRows(installmentRows.filter((_, i) => i !== idx));
                            }}
                            style={{ padding: '8px 10px', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setInstallmentRows([...installmentRows, { amount: '', due_date: '', note: '' }])}
                    >
                      ＋ {t('finance.addInstallment')}
                    </button>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Total sum: <span style={{ color: 'var(--color-primary)' }}>
                        ${installmentRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0)}
                      </span> / ${contractForm.amount || 0}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-group text-start">
            <label className="form-label">Contract Status</label>
            <select className="form-select" value={contractForm.status} onChange={e => setContractForm({ ...contractForm, status: e.target.value as any })}>
              <option value="active">{t('clients.active')}</option>
              <option value="expired">{t('clients.inactive')}</option>
              <option value="cancelled">{t('clients.onHold')}</option>
            </select>
          </div>

          {contractForm.is_recurring && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group text-start">
                <label className="form-label">{t('finance.startDate')}</label>
                <input type="date" className="form-input" value={contractForm.start_date} onChange={e => setContractForm({ ...contractForm, start_date: e.target.value })} />
              </div>
              <div className="form-group text-start">
                <label className="form-label">{t('finance.renewalDate')}</label>
                <input type="date" className="form-input" value={contractForm.renewal_date} onChange={e => setContractForm({ ...contractForm, renewal_date: e.target.value })} />
              </div>
            </div>
          )}
          {!contractForm.is_recurring && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group text-start">
                <label className="form-label">Service Date (Optional)</label>
                <input type="date" className="form-input" value={contractForm.start_date} onChange={e => setContractForm({ ...contractForm, start_date: e.target.value })} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setContractModalOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('clients.savingProgress') : modalMode === 'create' ? t('finance.createContract') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── EXPENSE MODAL ── */}
      <Modal isOpen={expenseModalOpen} onClose={() => setExpenseModalOpen(false)} title={modalMode === 'create' ? t('finance.createExpense') : t('finance.editExpense')}>
        <form onSubmit={handleExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="text-start">
          {errorMsg && <div className="form-error" style={{ padding: 10, background: '#fff1f2', color: '#be123c', fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)' }}>{errorMsg}</div>}

          <div className="form-group text-start">
            <label className="form-label">{t('finance.expenseTitle')} *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Canva Pro Yearly"
              value={expenseForm.title}
              onChange={e => setExpenseForm({ ...expenseForm, title: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group text-start">
              <label className="form-label">{t('finance.amount')} ($) *</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                required
              />
            </div>

            <div className="form-group text-start">
              <label className="form-label">{t('finance.category')} *</label>
              <select
                className="form-select"
                value={expenseForm.category}
                onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value as ExpenseCategory })}
                required
              >
                <option value="ads">📣 Ads Spend</option>
                <option value="software">🖥️ Software</option>
                <option value="office">🏢 Office</option>
                <option value="freelancer">🧑‍💻 Freelancer</option>
                <option value="other">📦 Other</option>
              </select>
            </div>
          </div>

          <div className="form-group text-start">
            <label className="form-label">{t('finance.date')} *</label>
            <input
              type="date"
              className="form-input"
              value={expenseForm.date}
              onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
              required
            />
          </div>

          <div className="form-group text-start">
            <label className="form-label">{t('finance.note')} (Optional)</label>
            <textarea
              className="form-textarea"
              placeholder="Any details or receipt links..."
              rows={2}
              value={expenseForm.note}
              onChange={e => setExpenseForm({ ...expenseForm, note: e.target.value })}
            />
          </div>

          <div className="form-group text-start">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={expenseForm.is_recurring}
                onChange={e => setExpenseForm({ ...expenseForm, is_recurring: e.target.checked })}
                style={{ cursor: 'pointer', width: 16, height: 16 }}
              />
              🔄 Recurring Cost (SaaS subscriptions, rent, etc.)
            </label>
          </div>

          {expenseForm.is_recurring && (
            <div className="form-group text-start">
              <label className="form-label">Recurrence Interval</label>
              <select
                className="form-select"
                value={expenseForm.recurrence}
                onChange={e => setExpenseForm({ ...expenseForm, recurrence: e.target.value as 'monthly' | 'yearly' })}
              >
                <option value="monthly">{t('finance.monthly')}</option>
                <option value="yearly">{t('finance.yearly')}</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setExpenseModalOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('clients.savingProgress') : modalMode === 'create' ? t('finance.createExpense') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── SALARY MODAL ── */}
      <Modal isOpen={salaryModalOpen} onClose={() => setSalaryModalOpen(false)} title={modalMode === 'create' ? t('finance.createSalary') : t('finance.editSalary')}>
        <form onSubmit={handleSalarySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="text-start">
          {errorMsg && <div className="form-error" style={{ padding: 10, background: '#fff1f2', color: '#be123c', fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)' }}>{errorMsg}</div>}

          {/* Team Member */}
          <div className="form-group text-start">
            <label className="form-label">{t('finance.teamMember')} *</label>
            <select className="form-select" value={salaryForm.user_id} onChange={e => setSalaryForm({ ...salaryForm, user_id: e.target.value })} required disabled={modalMode === 'edit'}>
              {modalMode === 'create' && <option value="" disabled>Select team member...</option>}
              {usersList.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>)}
            </select>
          </div>

          {/* Amount + Payment Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group text-start">
              <label className="form-label">{t('finance.amount')} ($) *</label>
              <input type="number" className="form-input" placeholder="2000" value={salaryForm.amount} onChange={e => setSalaryForm({ ...salaryForm, amount: e.target.value })} required />
            </div>
            <div className="form-group text-start">
              <label className="form-label">{t('finance.paymentDate')} *</label>
              <input
                type="date"
                className="form-input"
                value={salaryForm.paid_date}
                onChange={e => setSalaryForm({ ...salaryForm, paid_date: e.target.value })}
                required
                disabled={modalMode === 'edit'}
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Month is auto-derived from this date
              </div>
            </div>
          </div>

          {/* Payment Type */}
          <div className="form-group text-start">
            <label className="form-label">Payment Type *</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ val: true, label: '🔄 ' + t('finance.recurring'), desc: 'Monthly / Yearly auto-recurring' }, { val: false, label: '💳 ' + t('finance.oneTime'), desc: 'Single or installment payment' }].map(opt => (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={() => setSalaryForm({ ...salaryForm, is_recurring: opt.val })}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-md)', textAlign: 'start',
                    border: `2px solid ${salaryForm.is_recurring === opt.val ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: salaryForm.is_recurring === opt.val ? 'var(--color-primary-light)' : 'var(--color-surface)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: salaryForm.is_recurring === opt.val ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recurrence (if recurring) */}
          {salaryForm.is_recurring && (
            <div className="form-group text-start">
              <label className="form-label">Recurrence Cycle</label>
              <select className="form-select" value={salaryForm.recurrence} onChange={e => setSalaryForm({ ...salaryForm, recurrence: e.target.value as 'monthly' | 'yearly' })}>
                <option value="monthly">{t('finance.monthly')}</option>
                <option value="yearly">{t('finance.yearly')}</option>
              </select>
            </div>
          )}

          {/* Installments (if one-time) */}
          {!salaryForm.is_recurring && (
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 14 }} className="text-start">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label className="form-label" style={{ margin: 0 }}>💳 {t('finance.installments')} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>(optional — leave empty for lump-sum)</span></label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSalaryInstallmentRows(prev => [...prev, { amount: '', due_date: '', paid: false, note: '' }])}>＋ Add</button>
              </div>
              {salaryInstallmentRows.map((row, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input type="number" className="form-input" placeholder="Amount" value={row.amount} onChange={e => setSalaryInstallmentRows(prev => prev.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))} style={{ marginBottom: 0 }} />
                  <input type="date" className="form-input" value={row.due_date} onChange={e => setSalaryInstallmentRows(prev => prev.map((r, i) => i === idx ? { ...r, due_date: e.target.value } : r))} style={{ marginBottom: 0 }} />
                  <input type="text" className="form-input" placeholder="Note (optional)" value={row.note} onChange={e => setSalaryInstallmentRows(prev => prev.map((r, i) => i === idx ? { ...r, note: e.target.value } : r))} style={{ marginBottom: 0 }} />
                  <button type="button" onClick={() => setSalaryInstallmentRows(prev => prev.filter((_, i) => i !== idx))} style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: '#fff1f2', color: '#be123c', border: '1px solid #fda4af', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>✕</button>
                </div>
              ))}
              {salaryInstallmentRows.length > 0 && salaryInstallmentRows[0].amount && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Installments total: <strong>{formatCurrency(salaryInstallmentRows.reduce((s, r) => s + (Number(r.amount) || 0), 0), locale)}</strong> of <strong>{formatCurrency(Number(salaryForm.amount) || 0, locale)}</strong>
                </div>
              )}
            </div>
          )}

          {/* Mark as Paid */}
          <div className="form-group text-start">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={salaryForm.paid} onChange={e => setSalaryForm({ ...salaryForm, paid: e.target.checked })} style={{ cursor: 'pointer', width: 16, height: 16 }} />
              ✅ {t('finance.paid')}
            </label>
          </div>

          {/* Note */}
          <div className="form-group text-start">
            <label className="form-label">{t('finance.note')} (Optional)</label>
            <textarea className="form-textarea" placeholder="e.g. Paid via Bank Transfer, includes bonus..." rows={2} value={salaryForm.note} onChange={e => setSalaryForm({ ...salaryForm, note: e.target.value })} />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setSalaryModalOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('clients.savingProgress') : modalMode === 'create' ? t('finance.createSalary') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

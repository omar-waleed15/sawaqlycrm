export type UserRole = 'owner' | 'team_leader' | 'sales' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  created_at?: string;
}

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'submitted' | 'revision' | 'completed';

export interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  user?: User;
  status: TaskStatus;
  submission_link?: string;
  completion_note?: string;
  feedback?: string;
  assigned_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status?: TaskStatus;           // legacy — per-assignee now
  due_date?: string;
  submission_link?: string;      // legacy
  feedback?: string;             // legacy
  progress_note?: string;        // legacy
  drive_link?: string;
  content_type?: string;
  content_description?: string;
  publish_date?: string;
  publish_notes?: string;
  completion_note?: string;      // legacy
  creator_id: string;
  assignee_id?: string;          // legacy — use task_assignees
  creator?: User;
  assignee?: User;               // legacy
  task_assignees?: TaskAssignee[];
  attachments?: Attachment[];
  comments?: Comment[];
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  user?: User;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  filename: string;
  storage_path: string;
  public_url?: string;
  mimetype: string;
  size: number;
  created_at: string;
}

export interface DashboardStats {
  total: number;
  completed: number;
  inProgress: number;
  submitted: number;
  todo: number;
  overdue: number;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive';
  pipeline_stage: 'new_lead' | 'contacted' | 'meeting_scheduled' | 'proposal_sent' | 'negotiation' | 'won' | 'lost';
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  client?: Client;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'completed' | 'on_hold';
  budget: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
}

export interface ContractInstallment {
  id: string;
  contract_id: string;
  amount: number;
  due_date: string;
  paid: boolean;
  note?: string;
  created_at: string;
}

export interface Contract {
  id: string;
  client_id: string;
  client?: Client;
  project_id?: string;
  project?: Project;
  name: string;
  amount: number;
  is_recurring: boolean;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  status: 'active' | 'expired' | 'cancelled';
  start_date?: string;
  renewal_date?: string;
  installments?: ContractInstallment[];
  created_at: string;
}

export type ExpenseCategory = 'ads' | 'software' | 'office' | 'freelancer' | 'salary' | 'other';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;             // YYYY-MM-DD
  note?: string;
  is_recurring: boolean;
  recurrence?: 'monthly' | 'yearly';
  created_by: string;
  created_at: string;
}

export interface SalaryInstallment {
  id: string;
  salary_id: string;
  amount: number;
  due_date?: string;
  paid: boolean;
  note?: string;
  created_at: string;
}

export interface Salary {
  id: string;
  user_id: string;
  user?: User;              // joined profile
  amount: number;
  month: string;            // YYYY-MM-DD (first of month)
  paid: boolean;
  paid_date?: string;       // actual payment date YYYY-MM-DD
  is_recurring: boolean;    // true = monthly recurring, false = one-time
  recurrence?: 'monthly' | 'yearly';
  installments?: SalaryInstallment[];
  note?: string;
  created_by: string;
  created_at: string;
}

export interface ExpenseStats {
  totalExpensesThisMonth: number;   // expenses + salaries combined
  totalSalariesThisMonth: number;
  totalOtherThisMonth: number;
  byCategory: Record<ExpenseCategory, number>;
  netProfitThisMonth: number;       // monthlyRevenue - totalExpensesThisMonth
}

export interface FinanceStats {
  totalClients: number;
  activeProjects: number;
  monthlyRevenue: number;
  upcomingRenewalsCount: number;
  totalExpensesThisMonth: number;
  netProfitThisMonth: number;
}

export type ContentRating = 'good' | 'medium' | 'bad';
export type ContentType = 'post' | 'story' | 'reel' | 'photos' | 'video' | 'carousel' | 'other';

export interface ContentIdea {
  id: string;
  title: string;
  description?: string;
  content_type?: ContentType | string;
  drive_link?: string;
  content_description?: string;
  rating: ContentRating;
  creator_id: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyAnalyticsDataPoint {
  month: string;
  revenue: number;
  collectedRevenue: number;
  expenses: number;
  salaries: number;
  otherExpenses: number;
  netProfit: number;
  netCashFlow: number;
  adsExpenses: number;
  softwareExpenses: number;
  officeExpenses: number;
  freelancerExpenses: number;
  otherGeneralExpenses: number;
}

export interface ProjectedAnalyticsDataPoint {
  month: string;
  projectedRevenue: number;
  projectedExpenses: number;
  projectedNet: number;
  projectedSalaries: number;
  projectedGeneralExpenses: number;
}

export interface AgingReceivableRecord {
  installmentId: string;
  contractId: string;
  contractName: string;
  clientName: string;
  company: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
}

export interface ReceivablesAgingData {
  current: AgingReceivableRecord[];
  overdue1_30: AgingReceivableRecord[];
  overdue31_60: AgingReceivableRecord[];
  overdue61_90: AgingReceivableRecord[];
  overdue90Plus: AgingReceivableRecord[];
  totalOverdue: number;
  totalOutstanding: number;
}

export interface TopClientData {
  id: string;
  name: string;
  company: string;
  totalRevenue: number;
  activeContractsCount: number;
}

export interface CurrentMonthSnapshot {
  month: string;
  revenue: number;
  expenses: number;
  salaries: number;
  generalExpenses: number;
  profit: number;
  profitMargin: number;
  expenseBreakdown: { key: string; value: number }[];
}

export interface FinanceAnalyticsPayload {
  currentMonth: CurrentMonthSnapshot;
  monthlyData: {
    month: string;
    revenue: number;
    collectedRevenue: number;
    expenses: number;
    salaries: number;
    netProfit: number;
    profitMargin: number;
    categoryBreakdown: Record<string, number>;
  }[];
  projections: {
    month: string;
    projectedRevenue: number;
    projectedRecurringRevenue?: number;
    projectedExpenses: number;
    projectedNet: number;
    projectedSalaries: number;
    projectedAdsExpenses?: number;
  }[];
  expenseCategoryList: { key: string; value: number }[];
  receivablesAging: ReceivablesAgingData;
  topClients: TopClientData[];
  kpis: {
    mrr: number;
    activeClients: number;
    burnRate: number;
    outstandingReceivables: number;
    overdueReceivables: number;
    ltmRevenue: number;
    ltmExpenses: number;
    ltmNetProfit: number;
    ltmMargin: number;
  };
}

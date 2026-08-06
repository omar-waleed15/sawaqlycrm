export type UserRole = 'owner' | 'team_leader' | 'sales' | 'member' | 'developer' | 'graphic_designer' | 'video_editor' | 'reel_maker' | 'moderation' | 'account_manager' | 'client' | 'content_creator';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
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
  rating?: number;
  assigned_at: string;
  updated_at: string;
  submitted_at?: string | null;
  total_time_spent: number;
  timer_started_at?: string | null;
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
  completion_note?: string;      // legacy
  creator_id: string;
  assignee_id?: string;          // legacy — use task_assignees
  client_id?: string;
  project_id?: string;
  is_deliverable?: boolean;
  estimated_time_minutes?: number | null;
  deliverable_type?: 'post' | 'reel' | 'story' | 'photo';
  deliverable_month?: string;
  creator?: User;
  assignee?: User;               // legacy
  client?: { id: string; name: string; company?: string; };
  task_assignees?: TaskAssignee[];
  attachments?: Attachment[];
  comments?: Comment[];
  is_archived?: boolean;
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

export interface ChatMessage {
  id: string;
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
  pipeline_stage: 'new_lead' | 'contacted' | 'no_answer' | 'meeting_scheduled' | 'meeting_done' | 'won' | 'lost';
  sales_rep_id?: string;
  meeting_date?: string;
  meeting_attendees?: string[];
  meeting_notes?: string;
  start_date?: string;
  address?: string;
  content_plan_link?: string;
  num_posts?: number;
  num_reels?: number;
  num_stories?: number;
  num_photos?: number;
  other_deliverables?: string;
  done_posts?: number;
  done_reels?: number;
  done_stories?: number;
  done_photos?: number;
  done_other?: boolean;
  deliverables_schedule?: {
    posts?: string[];
    reels?: string[];
    stories?: string[];
    photos?: string[];
  };
  user_id?: string;
  sales_rep?: {
    id: string;
    name: string;
  };
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
  name: string;
  amount: number;
  is_recurring: boolean;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  status: 'active' | 'expired' | 'cancelled';
  start_date?: string;
  renewal_date?: string;
  sales_rep_id?: string;
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

export interface SalaryPenalty {
  id: string;
  salary_id: string;
  amount: number;
  notes?: string;
  created_at: string;
}

export interface SalaryBonus {
  id: string;
  salary_id: string;
  amount: number;
  notes?: string;
  created_at: string;
}

export interface SalaryAdvance {
  id: string;
  salary_id: string;
  amount: number;
  notes?: string;
  date?: string;
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
  penalties?: SalaryPenalty[];
  bonuses?: SalaryBonus[];
  advances?: SalaryAdvance[];
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

export interface SalesTarget {
  id: string;
  user_id: string;
  target_amount: number;
  month: string;
  created_at?: string;
}

export interface TaskTarget {
  id: string;
  user_id: string;
  target_tasks: number;
  month: string;
  created_at?: string;
}

export interface SalesCallLog {
  id: string;
  client_id: string;
  sales_rep_id: string;
  notes?: string;
  outcome: string;
  call_date: string;
  client?: Client;
}

export interface SalesDashboardData {
  target: SalesTarget | null;
  achievements: {
    mrr: number;
    totalDealsWon: number;
    totalMeetingsDone: number;
    collectedRevenue: number;
  };
  phoneList: Client[];
  historicalDeals: Client[];
  callLogs: SalesCallLog[];
}

export interface UserTaskPerformanceStats {
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  completionRate: number;
  averageRating: number | null;
  taskTarget: number | null;
  averageCompletionTime: number | null;
  onTimeRate: number | null;
  netTimeVarianceSeconds: number | null;
  overtimeTasksCount: number;
}

export interface UserSalesPerformanceStats {
  leadsManaged: number;
  callsLogged: number;
  dealsWon: number;
  closedRevenue: number;
  conversionRate: number;
  salesTarget: number | null;
  meetingsDone: number;
}

export interface UserPerformanceRecord {
  user: User;
  taskStats: UserTaskPerformanceStats;
  salesStats: UserSalesPerformanceStats;
}

// ── Closed Clients sub-features ─────────────────────────────────────────

export interface ClientFAQ {
  id: string;
  client_id: string;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ClientContentPlan {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  content_type?: string;
  status: 'draft' | 'approved' | 'published';
  scheduled_date?: string;
  drive_link?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientIdea {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  color: string;
  status: 'idea' | 'scheduled' | 'done';
  drive_link?: string;
  attachment_url?: string;
  attachment_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientReport {
  id: string;
  client_id: string;
  report_month: string;
  views: number;
  interactions: number;
  messages: number;
  num_posts: number;
  num_reels: number;
  num_stories: number;
  num_photos: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ReminderAttachment {
  url: string;
  name: string;
  type: 'image' | 'file';
  size?: number;
}

export interface Reminder {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  attachments?: ReminderAttachment[];
  review_link?: string;
  read_at?: string;
  completed_at?: string;
  created_at: string;
  sender?: { name: string; avatar_url?: string };
  receiver?: { name: string; avatar_url?: string };
}

export interface ContentItem {
  id: string;
  client_id?: string;
  title?: string;
  caption?: string;
  description?: string;
  content_type: 'post' | 'photo' | 'reel' | 'story';
  sound?: string;
  drive_link?: string;
  media_urls?: string[];
  platform?: string;
  scheduled_date?: string;
  client?: { id: string; name: string; company?: string };
  created_at?: string;
  updated_at?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface PersonalNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: 'text' | 'todo';
  todo_items: TodoItem[];
  created_at: string;
  updated_at: string;
}

// ── Client Directory / Onboarding Types ─────────────────────────────────

export interface OnboardingOverview {
  business_name?: string;
  industry?: string;
  business_description?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  google_maps_url?: string;
  year_founded?: number | string;
  email?: string;
  phone?: string;
  owner_name?: string;
  owner_position?: string;
  owner_phone?: string;
  owner_email?: string;
  primary_contact_name?: string;
  primary_contact_position?: string;
  primary_contact_phone?: string;
  primary_contact_email?: string;
  company_status?: 'Lead' | 'Discovery' | 'Onboarding' | 'Active Client' | 'Paused' | 'Former Client' | string;
  social_instagram?: string;
  social_tiktok?: string;
  social_facebook?: string;
  social_linkedin?: string;
  social_youtube?: string;
  social_website?: string;
}

export interface OnboardingUploadedFile {
  name: string;
  category: string;
  public_url: string;
  mimetype?: string;
  size?: number;
  storage_path?: string;
  uploaded_at?: string;
}

export interface OnboardingBrandAssets {
  uploaded_files?: OnboardingUploadedFile[];
  color_palette?: string[];
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  typography?: string;
  brand_style_notes?: string;
  visual_inspiration?: string;
  moodboard_links?: string;
  additional_brand_notes?: string;
}

export interface OnboardingBusinessDiscovery {
  about?: {
    description?: string;
    products?: string;
    services?: string;
    best_selling?: string;
    highest_profit?: string;
    usp?: string;
  };
  goals?: {
    why_hired?: string;
    main_objective?: string;
    short_term_goals?: string;
    long_term_goals?: string;
    success_metrics?: string;
    current_priorities?: string;
  };
  pain_points?: string[];
  pain_points_notes?: string;
  agency_opportunity?: {
    biggest_opportunity?: string;
    quick_wins?: string;
    long_term_opportunities?: string;
    content_opportunities?: string;
    campaign_ideas?: string;
    growth_opportunities?: string;
    seasonal_opportunities?: string;
    recommended_services?: string;
    strategy_notes?: string;
  };
}

export interface OnboardingTargetAudience {
  primary_audience?: {
    age_range?: string;
    gender?: string;
    location?: string;
    occupation?: string;
    income_level?: string;
    interests?: string[];
    hobbies?: string[];
    pain_points?: string;
    buying_motivations?: string;
    buying_objections?: string;
  };
  customer_notes?: string;
}

export interface OnboardingCompetitorItem {
  id: string;
  name: string;
  website?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  strengths?: string;
  weaknesses?: string;
  content_style?: string;
  doing_well?: string;
  missing?: string;
  opportunities?: string;
  notes?: string;
}

export interface OnboardingCompetitorAnalysis {
  competitors?: OnboardingCompetitorItem[];
  analysis?: {
    strengths?: string;
    weaknesses?: string;
    content_style?: string;
    doing_well?: string;
    missing?: string;
    opportunities?: string;
    notes?: string;
  };
}

export interface OnboardingSocialMediaAuditItem {
  platform: 'Instagram' | 'TikTok' | 'Facebook' | 'LinkedIn' | 'YouTube' | string;
  username?: string;
  profile_url?: string;
  followers?: string;
  posting_frequency?: string;
  average_engagement?: string;
  best_content?: string;
  weakest_content?: string;
  notes?: string;
}

export interface OnboardingSocialMediaAudit {
  platforms?: OnboardingSocialMediaAuditItem[];
  overall_notes?: string;
}

export interface OnboardingContentStrategy {
  brand_voice?: string[];
  content_pillars?: string[];
  content_style?: string[];
  things_to_avoid?: string;
  creative_notes?: string;
}

export interface ClientOnboarding {
  id?: string;
  client_id: string;
  current_step: number;
  completed_steps: number[];
  client_overview?: OnboardingOverview;
  brand_assets?: OnboardingBrandAssets;
  business_discovery?: OnboardingBusinessDiscovery;
  target_audience?: OnboardingTargetAudience;
  competitor_analysis?: OnboardingCompetitorAnalysis;
  social_media_audit?: OnboardingSocialMediaAudit;
  content_strategy?: OnboardingContentStrategy;
  created_at?: string;
  updated_at?: string;
}


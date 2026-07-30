import { toCairoISOString } from './dateUtils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function sanitizePayloadDates(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayloadDates);
  
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const keyLower = key.toLowerCase();
    if (typeof val === 'string' && (keyLower.includes('date') || keyLower.includes('time')) && val.includes('T')) {
      result[key] = toCairoISOString(val);
    } else if (typeof val === 'object' && val !== null) {
      result[key] = sanitizePayloadDates(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body = options.body;
  if (typeof body === 'string' && body.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(body);
      const sanitized = sanitizePayloadDates(parsed);
      body = JSON.stringify(sanitized);
    } catch (e) {
      // Keep original body if parsing fails
    }
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      cache: 'no-store',
      ...options,
      body,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        ...headers,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const isAuthLogin = endpoint.startsWith('/auth/login');
      if (!isAuthLogin && (res.status === 401 || data.error === 'Invalid or expired token')) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach backend API');
    }
    throw err;
  }
}

function uploadFile(
  endpoint: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${endpoint}`);

    const token = getToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = { error: xhr.responseText };
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        if (xhr.status === 401 || data.error === 'Invalid or expired token') {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
        }
        reject(new Error(data.error || `HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload'));
    xhr.send(formData);
  });
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string; user: import('@/types').User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: import('@/types').User }>('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
};

// Users
export const usersApi = {
  list: () => request<{ users: import('@/types').User[] }>('/users'),
  create: (data: { name: string; email: string; password: string; role: string; phone?: string | null }) =>
    request<{ user: import('@/types').User }>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; role: string; email?: string; password?: string; phone?: string | null }>) =>
    request<{ user: import('@/types').User }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
  updateProfile: (data: Partial<{ name: string; avatar_url: string | null; phone: string | null; email: string; password: string; currentPassword: string }>) =>
    request<{ user: import('@/types').User }>('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return uploadFile('/users/profile/avatar', formData) as Promise<{ publicUrl: string; user?: import('@/types').User }>;
  },
  performance: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ performance: import('@/types').UserPerformanceRecord[] }>(`/users/performance${query}`);
  },
};

// Tasks
export const tasksApi = {
  list: (params?: { status?: string; priority?: string; assignee_id?: string; archived?: string; client_id?: string }) => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<{ tasks: import('@/types').Task[] }>(`/tasks${query}`);
  },
  daily: () => request<{ tasks: import('@/types').Task[] }>('/tasks/daily'),
  stats: () => request<{ stats: import('@/types').DashboardStats }>('/tasks/stats'),
  get: (id: string) => request<{ task: import('@/types').Task }>(`/tasks/${id}`),
  create: async (data: Partial<import('@/types').Task> & { assignee_ids?: string[] }) => {
    const res = await request<{ task: import('@/types').Task }>('/tasks', { method: 'POST', body: JSON.stringify(data) });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-task-created', { detail: res.task }));
    }
    return res;
  },
  update: async (id: string, data: Partial<import('@/types').Task> & { assignee_ids?: string[] }) => {
    const res = await request<{ task: import('@/types').Task }>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-task-updated', { detail: res.task }));
    }
    return res;
  },
  delete: async (id: string) => {
    const res = await request(`/tasks/${id}`, { method: 'DELETE' });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-task-deleted', { detail: { id } }));
    }
    return res;
  },
  addAssignee: (taskId: string, userId: string) =>
    request<{ task: import('@/types').Task }>(`/tasks/${taskId}/assignees`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  removeAssignee: (taskId: string, userId: string) =>
    request<{ task: import('@/types').Task }>(`/tasks/${taskId}/assignees/${userId}`, { method: 'DELETE' }),
  updateAssignee: (taskId: string, userId: string, data: { status?: string; feedback?: string; rating?: number }) =>
    request<{ task: import('@/types').Task }>(`/tasks/${taskId}/assignees/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  startTimer: (id: string) =>
    request<{ task: import('@/types').Task }>(`/tasks/${id}/timer/start`, { method: 'POST' }),
  stopTimer: (id: string) =>
    request<{ task: import('@/types').Task }>(`/tasks/${id}/timer/stop`, { method: 'POST' }),
  getTarget: (userId: string, month: string) =>
    request<{ target: import('@/types').TaskTarget | null }>(`/tasks/target/${userId}/${month}`),
  setTarget: (userId: string, month: string, targetTasks: number) =>
    request<{ target: import('@/types').TaskTarget }>('/tasks/target', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, month, target_tasks: targetTasks }),
    }),
  getProgress: (userId: string, month: string) =>
    request<{ target: number; completedTasks: number; progressPercent: number }>(`/tasks/target/${userId}/${month}/progress`),
};

// Comments
export const commentsApi = {
  list: (taskId: string) =>
    request<{ comments: import('@/types').Comment[] }>(`/tasks/${taskId}/comments`),
  create: (taskId: string, content: string) =>
    request<{ comment: import('@/types').Comment }>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

// Global Chat
export const chatApi = {
  list: () =>
    request<{ messages: import('@/types').ChatMessage[] }>('/chat'),
  create: (content: string) =>
    request<{ message: import('@/types').ChatMessage }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

// Attachments
export const attachmentsApi = {
  upload: (taskId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadFile(`/tasks/${taskId}/attachments`, formData);
  },
  delete: (taskId: string, attachmentId: string) =>
    request(`/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' }),
};

// Clients
export const clientsApi = {
  list: () => request<{ clients: import('@/types').Client[] }>('/clients'),
  create: (data: Partial<import('@/types').Client>) =>
    request<{ client: import('@/types').Client }>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<import('@/types').Client>) =>
    request<{ client: import('@/types').Client }>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/clients/${id}`, { method: 'DELETE' }),
  customReport: (startDate: string, endDate: string) =>
    request<{ clients: any[] }>(`/clients/reports/custom?startDate=${startDate}&endDate=${endDate}`),
};

// Projects
export const projectsApi = {
  list: () => request<{ projects: import('@/types').Project[] }>('/projects'),
  create: (data: Partial<import('@/types').Project>) =>
    request<{ project: import('@/types').Project }>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<import('@/types').Project>) =>
    request<{ project: import('@/types').Project }>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/projects/${id}`, { method: 'DELETE' }),
};

// Contracts
export const contractsApi = {
  list: () => request<{ contracts: import('@/types').Contract[] }>('/contracts'),
  create: (data: Partial<import('@/types').Contract>) =>
    request<{ contract: import('@/types').Contract }>('/contracts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<import('@/types').Contract>) =>
    request<{ contract: import('@/types').Contract }>(`/contracts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/contracts/${id}`, { method: 'DELETE' }),
  stats: () => request<{ stats: import('@/types').FinanceStats }>('/contracts/finance-stats'),
  markInstallmentPaid: (contractId: string, installmentId: string, paid: boolean) =>
    request<{ installment: import('@/types').ContractInstallment }>(`/contracts/${contractId}/installments/${installmentId}/paid`, {
      method: 'PATCH',
      body: JSON.stringify({ paid }),
    }),
};

// Content Ideas
export const contentIdeasApi = {
  list: () => request<{ ideas: import('@/types').ContentIdea[] }>('/ideas'),
  create: (data: Partial<import('@/types').ContentIdea>) =>
    request<{ idea: import('@/types').ContentIdea }>('/ideas', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<import('@/types').ContentIdea>) =>
    request<{ idea: import('@/types').ContentIdea }>(`/ideas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/ideas/${id}`, { method: 'DELETE' }),
};

// Expenses
export const expensesApi = {
  list: (params?: { category?: string; month?: string }) => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<{ expenses: import('@/types').Expense[] }>(`/expenses${query}`);
  },
  stats: () => request<{ stats: import('@/types').ExpenseStats }>('/expenses/stats'),
  create: (data: Partial<import('@/types').Expense>) =>
    request<{ expense: import('@/types').Expense }>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<import('@/types').Expense>) =>
    request<{ expense: import('@/types').Expense }>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/expenses/${id}`, { method: 'DELETE' }),
};

// Salaries
export const salariesApi = {
  list: (params?: { month?: string }) => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<{ salaries: import('@/types').Salary[] }>(`/salaries${query}`);
  },
  getMySalary: (params?: { month?: string }) => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<{ salary: import('@/types').Salary | null; availableMonths: string[] }>(`/salaries/my-salary${query}`);
  },
  create: (data: any) =>
    request<{ salary: import('@/types').Salary }>('/salaries', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<{ salary: import('@/types').Salary }>(`/salaries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/salaries/${id}`, { method: 'DELETE' }),
  markInstallmentPaid: (salaryId: string, instId: string, paid: boolean) =>
    request(`/salaries/${salaryId}/installments/${instId}/paid`, { method: 'PATCH', body: JSON.stringify({ paid }) }),
  createPenalty: (salaryId: string, data: { amount: number; notes?: string }) =>
    request<{ penalty: import('@/types').SalaryPenalty }>(`/salaries/${salaryId}/penalties`, { method: 'POST', body: JSON.stringify(data) }),
  deletePenalty: (salaryId: string, id: string) =>
    request(`/salaries/${salaryId}/penalties/${id}`, { method: 'DELETE' }),
  createAdvance: (salaryId: string, data: { amount: number; notes?: string; date?: string }) =>
    request<{ advance: import('@/types').SalaryAdvance }>(`/salaries/${salaryId}/advances`, { method: 'POST', body: JSON.stringify(data) }),
  deleteAdvance: (salaryId: string, id: string) =>
    request(`/salaries/${salaryId}/advances/${id}`, { method: 'DELETE' }),
};

// Finance Analytics
export const financeAnalyticsApi = {
  getDashboard: () => request<import('@/types').FinanceAnalyticsPayload>('/finance-analytics'),
  customReport: (startDate: string, endDate: string) =>
    request<{ lineItems: any[] }>(`/finance-analytics/custom-report?startDate=${startDate}&endDate=${endDate}`),
};

// Sales API
export const salesApi = {
  getDashboard: (userId?: string) => request<import('@/types').SalesDashboardData>(`/sales/dashboard${userId ? `?userId=${userId}` : ''}`),
  getCalendarEvents: (params?: { userId?: string }) => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<{
      meetings: import('@/types').Client[];
      callLogs: import('@/types').SalesCallLog[];
      contracts: import('@/types').Contract[];
      salesReps: import('@/types').User[];
    }>(`/sales/calendar-events${query}`);
  },
  getLead: (leadId: string) =>
    request<{ lead: import('@/types').Client; callLogs: import('@/types').SalesCallLog[] }>(`/sales/leads/${leadId}`),
  getTarget: (userId: string, month: string) =>
    request<{ target: import('@/types').SalesTarget | null }>(`/sales/target/${userId}/${month}`),
  setTarget: (userId: string, month: string, targetAmount: number) =>
    request<{ target: import('@/types').SalesTarget }>('/sales/target', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, month, target_amount: targetAmount }),
    }),
  createLead: (data: { name: string; company?: string; email?: string; address?: string; phone: string; pipeline_stage?: string } | { name: string; company?: string; email?: string; address?: string; phone: string; pipeline_stage?: string }[]) =>
    request<{ lead?: import('@/types').Client; leads?: import('@/types').Client[] }>('/sales/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  logCall: (leadId: string, data: { notes?: string; outcome: string; meeting_date?: string; meeting_attendees?: string[]; meeting_notes?: string }) => {
    const payload = { ...data };
    if (payload.meeting_date) {
      payload.meeting_date = toCairoISOString(payload.meeting_date);
    }
    return request<{ lead: import('@/types').Client }>(`/sales/leads/${leadId}/calls`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  closeWon: (leadId: string, data?: {
    name?: string;
    amount?: number;
    is_recurring?: boolean;
    billing_cycle?: string;
    start_date?: string;
    renewal_date?: string;
    tasks?: {
      title: string;
      description?: string;
      priority: string;
      dueDate?: string;
      contentType?: string;
      contentDescription?: string;
    }[];
  }) =>
    request<{
      message: string;
      contract?: import('@/types').Contract;
      tasks?: import('@/types').Task[];
    }>(`/sales/leads/${leadId}/close-won`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
};

// Closed Clients
export const closedClientsApi = {
  list: () => request<{ clients: import('@/types').Client[] }>('/closed-clients'),
  get: (id: string) => request<{ client: import('@/types').Client }>(`/closed-clients/${id}`),

  // FAQ
  listFaq: (clientId: string) =>
    request<{ faq: import('@/types').ClientFAQ[] }>(`/closed-clients/${clientId}/faq`),
  createFaq: (clientId: string, data: { question: string; answer: string; sort_order?: number }) =>
    request<{ faq: import('@/types').ClientFAQ }>(`/closed-clients/${clientId}/faq`, { method: 'POST', body: JSON.stringify(data) }),
  updateFaq: (clientId: string, faqId: string, data: Partial<import('@/types').ClientFAQ>) =>
    request<{ faq: import('@/types').ClientFAQ }>(`/closed-clients/${clientId}/faq/${faqId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFaq: (clientId: string, faqId: string) =>
    request(`/closed-clients/${clientId}/faq/${faqId}`, { method: 'DELETE' }),

  // Content Plans
  listPlans: (clientId: string) =>
    request<{ plans: import('@/types').ClientContentPlan[] }>(`/closed-clients/${clientId}/content-plans`),
  createPlan: (clientId: string, data: Partial<import('@/types').ClientContentPlan>) =>
    request<{ plan: import('@/types').ClientContentPlan }>(`/closed-clients/${clientId}/content-plans`, { method: 'POST', body: JSON.stringify(data) }),
  updatePlan: (clientId: string, planId: string, data: Partial<import('@/types').ClientContentPlan>) =>
    request<{ plan: import('@/types').ClientContentPlan }>(`/closed-clients/${clientId}/content-plans/${planId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlan: (clientId: string, planId: string) =>
    request(`/closed-clients/${clientId}/content-plans/${planId}`, { method: 'DELETE' }),

  // Ideas
  listIdeas: (clientId: string) =>
    request<{ ideas: import('@/types').ClientIdea[] }>(`/closed-clients/${clientId}/ideas`),
  createIdea: (clientId: string, data: Partial<import('@/types').ClientIdea>) =>
    request<{ idea: import('@/types').ClientIdea }>(`/closed-clients/${clientId}/ideas`, { method: 'POST', body: JSON.stringify(data) }),
  updateIdea: (clientId: string, ideaId: string, data: Partial<import('@/types').ClientIdea>) =>
    request<{ idea: import('@/types').ClientIdea }>(`/closed-clients/${clientId}/ideas/${ideaId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIdea: (clientId: string, ideaId: string) =>
    request(`/closed-clients/${clientId}/ideas/${ideaId}`, { method: 'DELETE' }),
  uploadIdeaAttachment: (clientId: string, formData: FormData) =>
    uploadFile(`/closed-clients/${clientId}/ideas/upload`, formData) as Promise<{ public_url: string; filename: string }>,

  // Reports
  listReports: (clientId: string) =>
    request<{ reports: import('@/types').ClientReport[] }>(`/closed-clients/${clientId}/reports`),
  getMonthlyCounts: (clientId: string, month: string) =>
    request<{ month: string; counts: { num_posts: number; num_reels: number; num_stories: number; num_photos: number } }>(`/closed-clients/${clientId}/reports/monthly-counts?month=${month}`),
  createReport: (clientId: string, data: Partial<import('@/types').ClientReport>) =>
    request<{ report: import('@/types').ClientReport }>(`/closed-clients/${clientId}/reports`, { method: 'POST', body: JSON.stringify(data) }),
  updateReport: (clientId: string, reportId: string, data: Partial<import('@/types').ClientReport>) =>
    request<{ report: import('@/types').ClientReport }>(`/closed-clients/${clientId}/reports/${reportId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReport: (clientId: string, reportId: string) =>
    request(`/closed-clients/${clientId}/reports/${reportId}`, { method: 'DELETE' }),
};

// Reminders API
export const remindersApi = {
  list: () => request<{ reminders: import('@/types').Reminder[] }>('/reminders'),
  uploadAttachment: (formData: FormData) =>
    uploadFile('/reminders/upload', formData) as Promise<import('@/types').ReminderAttachment>,
  create: (data: { receiver_ids: string[]; content: string; attachments?: import('@/types').ReminderAttachment[]; review_link?: string }) =>
    request<{ reminders: import('@/types').Reminder[] }>('/reminders', { method: 'POST', body: JSON.stringify(data) }),
  markRead: (id: string) =>
    request<{ reminder: import('@/types').Reminder }>(`/reminders/${id}/read`, { method: 'PUT' }),
  markDone: (id: string) =>
    request<{ reminder: import('@/types').Reminder }>(`/reminders/${id}/done`, { method: 'PUT' }),
  delete: (id: string) =>
    request(`/reminders/${id}`, { method: 'DELETE' }),
};

// Contents API
export const contentsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ contents: import('@/types').ContentItem[] }>(`/contents${qs}`);
  },
  create: (data: Partial<import('@/types').ContentItem>) =>
    request<{ content: import('@/types').ContentItem }>('/contents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<import('@/types').ContentItem>) =>
    request<{ content: import('@/types').ContentItem }>(`/contents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/contents/${id}`, { method: 'DELETE' }),
  upload: (formData: FormData, onProgress?: (percent: number) => void) =>
    uploadFile('/contents/upload', formData, onProgress) as Promise<{ public_urls: string[] }>,
};

// Client Chat API
export const clientChatApi = {
  listRooms: () => request<{ rooms: any[] }>('/client-chat/rooms'),
  listMessages: (clientId: string) => request<{ messages: any[] }>(`/client-chat/rooms/${clientId}/messages`),
  sendMessage: (clientId: string, content: string) =>
    request<{ message: any }>(`/client-chat/rooms/${clientId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

// Personal Notes API
export const notesApi = {
  list: () => request<{ notes: import('@/types').PersonalNote[] }>('/notes'),
  create: (data: Partial<import('@/types').PersonalNote>) =>
    request<{ note: import('@/types').PersonalNote }>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<import('@/types').PersonalNote>) =>
    request<{ note: import('@/types').PersonalNote }>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request(`/notes/${id}`, { method: 'DELETE' }),
};

// Campaigns API
export const campaignsApi = {
  list: () => request<{ campaigns: any[] }>('/campaigns'),
  create: (name: string, messageTemplate: string, file: File) => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('message_template', messageTemplate);
    formData.append('file', file);
    return uploadFile('/campaigns', formData) as Promise<{ campaign: any }>;
  },
  triggerAction: (id: string, action: 'start' | 'pause') =>
    request<{ campaign: any }>(`/campaigns/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  delete: (id: string) => request(`/campaigns/${id}`, { method: 'DELETE' }),
};

export interface RoleData {
  id: string;
  role_key: string;
  description: string;
  general_roles?: string;
  job_description?: string;
  job_roles?: string;
  non_negotiables?: string;
  updated_at: string;
  updated_by: string | null;
}

// Roles API
export const rolesApi = {
  list: () => request<{ roles: RoleData[] }>('/roles'),
  update: (roleKey: string, data: Partial<RoleData>) =>
    request<{ role: RoleData }>(`/roles/${roleKey}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Client Onboarding / Directory API
export const clientOnboardingApi = {
  get: (clientId: string) =>
    request<{ client: import('@/types').Client; onboarding: import('@/types').ClientOnboarding }>(`/client-onboarding/${clientId}`),
  
  update: (clientId: string, data: Partial<import('@/types').ClientOnboarding>) =>
    request<{ onboarding: import('@/types').ClientOnboarding }>(`/client-onboarding/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateStep: (clientId: string, stepNum: number, body: { stepData: any; completedSteps?: number[]; currentStep?: number }) =>
    request<{ onboarding: import('@/types').ClientOnboarding }>(`/client-onboarding/${clientId}/step/${stepNum}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  uploadAsset: (clientId: string, file: File, category: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    return uploadFile(`/client-onboarding/${clientId}/upload`, formData) as Promise<{ file: import('@/types').OnboardingUploadedFile }>;
  },

  deleteAsset: (clientId: string, storage_path: string) =>
    request(`/client-onboarding/${clientId}/upload`, {
      method: 'DELETE',
      body: JSON.stringify({ storage_path }),
    }),
};


const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

async function request<T>(
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

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401 || data.error === 'Invalid or expired token') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data as T;
}

async function uploadFile(endpoint: string, formData: FormData): Promise<unknown> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401 || data.error === 'Invalid or expired token') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
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
  create: (data: { name: string; email: string; password: string; role: string }) =>
    request<{ user: import('@/types').User }>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; role: string }>) =>
    request<{ user: import('@/types').User }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
};

// Tasks
export const tasksApi = {
  list: (params?: { status?: string; priority?: string; assignee_id?: string }) => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<{ tasks: import('@/types').Task[] }>(`/tasks${query}`);
  },
  daily: () => request<{ tasks: import('@/types').Task[] }>('/tasks/daily'),
  stats: () => request<{ stats: import('@/types').DashboardStats }>('/tasks/stats'),
  get: (id: string) => request<{ task: import('@/types').Task }>(`/tasks/${id}`),
  create: (data: Partial<import('@/types').Task> & { assignee_ids?: string[] }) =>
    request<{ task: import('@/types').Task }>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<import('@/types').Task> & { assignee_ids?: string[] }) =>
    request<{ task: import('@/types').Task }>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),
  addAssignee: (taskId: string, userId: string) =>
    request<{ task: import('@/types').Task }>(`/tasks/${taskId}/assignees`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  removeAssignee: (taskId: string, userId: string) =>
    request<{ task: import('@/types').Task }>(`/tasks/${taskId}/assignees/${userId}`, { method: 'DELETE' }),
  updateAssignee: (taskId: string, userId: string, data: { status?: string; feedback?: string }) =>
    request<{ task: import('@/types').Task }>(`/tasks/${taskId}/assignees/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
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
  create: (data: any) =>
    request<{ salary: import('@/types').Salary }>('/salaries', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<{ salary: import('@/types').Salary }>(`/salaries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/salaries/${id}`, { method: 'DELETE' }),
  markInstallmentPaid: (salaryId: string, instId: string, paid: boolean) =>
    request(`/salaries/${salaryId}/installments/${instId}/paid`, { method: 'PATCH', body: JSON.stringify({ paid }) }),
};

// Finance Analytics
export const financeAnalyticsApi = {
  getDashboard: () => request<import('@/types').FinanceAnalyticsPayload>('/finance-analytics'),
};

'use client';

import { useEffect, useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { clientsApi, projectsApi, tasksApi } from '@/lib/api';
import { Client, Project, Task, User } from '@/types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  ExternalLink,
  MapPin,
  Calendar,
  Briefcase,
  ListTodo,
  Loader2,
} from 'lucide-react';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getTaskOverallStatus(task: Task): { label: string; className: string } {
  if (!task.task_assignees || task.task_assignees.length === 0) {
    return { label: 'In Progress', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
  }
  const allCompleted = task.task_assignees.every(a => a.status === 'completed');
  if (allCompleted) {
    return { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
  }
  return { label: 'In Progress', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
}

const PROJECT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  planning: { label: 'Planning', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  active: { label: 'Active', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  on_hold: { label: 'On Hold', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
};

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function ClientsDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Navigation Guard: only owner (admin), team_leader, or account_manager
  useEffect(() => {
    if (user && !['owner', 'team_leader', 'account_manager'].includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // General States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'clients' | 'projects'>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Search Filters
  const [clientSearch, setClientSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');

  // Expanded client rows
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // Modals States
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected for Edit
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

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
      });
      setSelectedClient(null);
      setModalMode('create');
    }
    setErrorMsg('');
  };

  // Reset Project Form
  const resetProjectForm = (project?: Project) => {
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
        client_id: clients[0]?.id || '',
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
      setErrorMsg('Client Name is required');
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
    if (!confirm(`Are you sure you want to delete client "${name}"? This will delete all their associated projects.`)) return;
    try {
      await clientsApi.delete(id);
      loadData(true);
    } catch (err) {
      alert('Failed to delete client');
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete project "${name}"?`)) return;
    try {
      await projectsApi.delete(id);
      loadData(true);
    } catch (err) {
      alert('Failed to delete project');
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

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Clients &amp; Projects Manager</h1>
          <p className="page-header-subtitle">
            Manage clients profiles, projects specifications, and track task statuses.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'clients' ? (
            <Button onClick={() => { resetClientForm(); setClientModalOpen(true); }}>
              <Plus className="size-4 mr-2" /> Add Client
            </Button>
          ) : (
            <Button onClick={() => { resetProjectForm(); setProjectModalOpen(true); }} disabled={clients.length === 0}>
              <Plus className="size-4 mr-2" /> Create Project
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
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          👥 Clients list
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'projects'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          🚀 Projects list
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 1. CLIENTS TAB */}
          {activeTab === 'clients' && (
            <div className="flex flex-col gap-4">
              {/* Search Bar */}
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                <Input
                  type="text"
                  placeholder="Search clients by name, company, email..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Clients Cards/Rows */}
              <div className="flex flex-col gap-3">
                {filteredClients.map(c => {
                  const clientProjects = projects.filter(p => p.client_id === c.id);
                  const clientTasks = tasks.filter(t => t.client_id === c.id);
                  const isExpanded = expandedClientId === c.id;

                  return (
                    <Card key={c.id} className="overflow-hidden transition-all duration-200">
                      <div
                        onClick={() => setExpandedClientId(isExpanded ? null : c.id)}
                        className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors select-none"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="size-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                            <div>
                              <h3 className="text-sm font-bold text-foreground leading-tight">{c.name}</h3>
                              <p className="text-xs text-muted-foreground truncate">{c.company || 'Private Client'}</p>
                            </div>
                            <div className="text-xs text-muted-foreground self-center">
                              {c.email && <div>📧 {c.email}</div>}
                              {c.phone && <div>📞 {c.phone}</div>}
                            </div>
                            <div className="flex gap-2 items-center md:justify-end">
                              <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                                {c.status}
                              </Badge>
                              <Badge variant="outline">
                                {clientProjects.length} Projects
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="pl-4">
                          {isExpanded ? (
                            <ChevronUp className="size-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="size-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <CardContent className="border-t border-border bg-muted/5 p-6 flex flex-col gap-6">
                          {/* Client Profile details */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-background border rounded-lg p-4 flex flex-col gap-2.5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                👥 Contact details
                              </h4>
                              <div className="text-sm space-y-1">
                                <div className="font-semibold">{c.name}</div>
                                {c.company && <div className="text-muted-foreground">{c.company}</div>}
                                {c.email && <div className="text-muted-foreground truncate">{c.email}</div>}
                                {c.phone && <div className="text-muted-foreground">{c.phone}</div>}
                              </div>
                              <div className="flex gap-2 justify-end mt-2 pt-2 border-t">
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); resetClientForm(c); setClientModalOpen(true); }}>
                                  <Edit className="size-3 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDeleteClient(c.id, c.name); }}>
                                  <Trash2 className="size-3 mr-1" /> Delete
                                </Button>
                              </div>
                            </div>

                            <div className="bg-background border rounded-lg p-4 flex flex-col gap-2.5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <MapPin className="size-3.5" /> Address &amp; Timeline
                              </h4>
                              <div className="text-sm space-y-2">
                                <div className="flex gap-1.5 items-start">
                                  <span className="text-xs text-muted-foreground font-semibold shrink-0">Start Date:</span>
                                  <span>{c.start_date ? formatDate(c.start_date) : 'Not specified'}</span>
                                </div>
                                <div className="flex gap-1.5 items-start">
                                  <span className="text-xs text-muted-foreground font-semibold shrink-0">Address:</span>
                                  <span className="text-muted-foreground whitespace-pre-line leading-snug">
                                    {c.address || 'No address specified'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-background border rounded-lg p-4 flex flex-col gap-2.5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                📁 Deliverables &amp; Content Plan
                              </h4>
                              <div className="text-sm space-y-2.5 flex-1">
                                {c.content_plan_link ? (
                                  <div className="flex flex-col gap-2">
                                    <div className="text-xs text-muted-foreground">Click the button below to view the client's Content Plan:</div>
                                    <a
                                      href={c.content_plan_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-xs transition-colors border border-indigo-200 dark:border-indigo-800/40 w-fit"
                                    >
                                      Open Content Plan <ExternalLink className="size-3" />
                                    </a>
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground italic text-xs">
                                    No Content Plan link registered. Edit the profile to add one.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Client Projects */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Briefcase className="size-3.5" /> Associated Projects ({clientProjects.length})
                            </h4>
                            {clientProjects.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {clientProjects.map(p => {
                                  const cfg = PROJECT_STATUS_CONFIG[p.status] || PROJECT_STATUS_CONFIG.planning;
                                  return (
                                    <div key={p.id} className="bg-background border rounded-lg p-4 space-y-2 flex flex-col justify-between">
                                      <div className="flex justify-between items-start gap-4">
                                        <div className="font-semibold text-sm">{p.name}</div>
                                        <Badge className={cfg.className}>{cfg.label}</Badge>
                                      </div>
                                      {p.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{p.description}</p>
                                      )}
                                      <div className="flex justify-end items-center text-xs text-muted-foreground pt-2 border-t">
                                        <span className="flex items-center gap-1"><Calendar className="size-3" /> {p.end_date ? formatDate(p.end_date) : 'N/A'}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic pl-1">No projects created under this client.</p>
                            )}
                          </div>

                          {/* Client Tasks */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <ListTodo className="size-3.5" /> Tasks Tracking ({clientTasks.length})
                            </h4>
                            {clientTasks.length > 0 ? (
                              <div className="border rounded-lg bg-background overflow-hidden">
                                <div className="table-responsive">
                                  <table className="table" style={{ margin: 0 }}>
                                    <thead>
                                      <tr className="text-xs text-muted-foreground bg-muted/20">
                                        <th className="py-2.5 px-4 font-bold">Task Title</th>
                                        <th className="py-2.5 px-4 font-bold">Assignees</th>
                                        <th className="py-2.5 px-4 font-bold">Due Date</th>
                                        <th className="py-2.5 px-4 font-bold">Task Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {clientTasks.map(t => {
                                        const overall = getTaskOverallStatus(t);
                                        return (
                                          <tr key={t.id} className="text-xs hover:bg-muted/5 transition-colors">
                                            <td className="py-3 px-4 font-semibold text-foreground">
                                              <a href={`/dashboard/tasks/${t.id}`} className="hover:underline hover:text-indigo-600 dark:hover:text-indigo-400">
                                                {t.title}
                                              </a>
                                            </td>
                                            <td className="py-3 px-4">
                                              <div className="flex -space-x-1.5 overflow-hidden">
                                                {t.task_assignees && t.task_assignees.length > 0 ? (
                                                  t.task_assignees.map(a => {
                                                    if (!a.user) return null;
                                                    return (
                                                      <div
                                                        key={a.id}
                                                        title={`${a.user.name} (${a.status})`}
                                                        className="size-5 rounded-full ring-2 ring-background bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                                                      >
                                                        {getInitials(a.user.name)}
                                                      </div>
                                                    );
                                                  })
                                                ) : (
                                                  <span className="text-muted-foreground italic text-[10px]">Unassigned</span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                              {t.due_date ? formatDate(t.due_date) : 'No due date'}
                                            </td>
                                            <td className="py-3 px-4">
                                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${overall.className}`}>
                                                {overall.label}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic pl-1">No tasks linked to this client yet.</p>
                            )}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
                {filteredClients.length === 0 && (
                  <div className="text-center py-10 border rounded-lg border-dashed text-muted-foreground text-sm">
                    No clients found matching query.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. PROJECTS TAB */}
          {activeTab === 'projects' && (
            <div className="flex flex-col gap-4">
              {/* Search Bar */}
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                <Input
                  type="text"
                  placeholder="Search projects by name or client..."
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Projects Grid Card View */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map(p => {
                  const cfg = PROJECT_STATUS_CONFIG[p.status] || PROJECT_STATUS_CONFIG.planning;
                  
                  // Calculate dynamic visual timeline progress if dates exist
                  let progressPercent = 0;
                  if (p.status === 'completed') {
                    progressPercent = 100;
                  } else if (p.start_date && p.end_date) {
                    const start = new Date(p.start_date).getTime();
                    const end = new Date(p.end_date).getTime();
                    const now = new Date().getTime();
                    if (now > start && end > start) {
                      progressPercent = Math.min(Math.round(((now - start) / (end - start)) * 100), 95);
                    } else if (now >= end) {
                      progressPercent = 95;
                    }
                  } else if (p.status === 'active') {
                    progressPercent = 35; // Default representative progress
                  }

                  return (
                    <Card key={p.id} className="relative overflow-hidden group hover:shadow-md transition-all duration-200 border border-border flex flex-col">
                      {/* Top border colored accent line */}
                      <div className={`h-1.5 w-full ${
                        p.status === 'planning' ? 'bg-slate-400' :
                        p.status === 'active' ? 'bg-indigo-500' :
                        p.status === 'on_hold' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />

                      <CardContent className="p-5 flex flex-col gap-4 flex-1">
                        {/* Header: Title and status badge */}
                        <div className="flex justify-between items-start gap-4">
                          <h3 className="font-bold text-sm text-foreground leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {p.name}
                          </h3>
                          <Badge className={`${cfg.className} shrink-0 text-[10px] px-2 py-0`}>{cfg.label}</Badge>
                        </div>

                        {/* Description */}
                        {p.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed flex-1">
                            {p.description}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/40 italic flex-1">
                            No project description provided.
                          </p>
                        )}

                        {/* Client details box */}
                        <div className="bg-muted/30 border border-border/50 rounded-lg p-3 flex items-center gap-3">
                          <div className="size-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {p.client?.name ? p.client.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Client Partner</div>
                            <div className="text-xs font-semibold text-foreground truncate">{p.client?.name || 'Unknown Client'}</div>
                            {p.client?.company && <div className="text-[10px] text-muted-foreground truncate">{p.client.company}</div>}
                          </div>
                        </div>

                        {/* Timeline */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="size-3 text-indigo-500" /> {p.start_date ? formatDate(p.start_date) : 'N/A'}</span>
                            <span>—</span>
                            <span className="flex items-center gap-1 font-semibold text-foreground"><Calendar className="size-3 text-rose-500" /> {p.end_date ? formatDate(p.end_date) : 'N/A'}</span>
                          </div>
                          {p.start_date && p.end_date && (
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  p.status === 'completed' ? 'bg-emerald-500' :
                                  p.status === 'on_hold' ? 'bg-amber-500' : 'bg-indigo-500'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 justify-end pt-3 border-t border-border/60 mt-2">
                          <Button size="sm" variant="outline" onClick={() => { resetProjectForm(p); setProjectModalOpen(true); }} className="h-8 text-xs">
                            <Edit className="size-3 mr-1.5" /> Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteProject(p.id, p.name)} className="h-8 text-xs">
                            <Trash2 className="size-3 mr-1.5" /> Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filteredProjects.length === 0 && (
                <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground text-sm">
                  No projects matching query.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── CLIENT CREATE / EDIT MODAL ── */}
      <Modal
        isOpen={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        title={modalMode === 'create' ? 'Add New Client' : 'Edit Client Profile'}
      >
        <form onSubmit={handleClientSubmit} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-2.5 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_name">Client Name *</Label>
            <Input
              id="c_name"
              placeholder="e.g. Khalifa Al-Kubaisi"
              value={clientForm.name}
              onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_company">Company Name</Label>
            <Input
              id="c_company"
              placeholder="e.g. Sawaqly Marketing"
              value={clientForm.company}
              onChange={e => setClientForm({ ...clientForm, company: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c_email">Email Address</Label>
              <Input
                id="c_email"
                type="email"
                placeholder="client@company.com"
                value={clientForm.email}
                onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c_phone">Phone Number</Label>
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
              <Label htmlFor="c_status">Account Status</Label>
              <Select
                value={clientForm.status}
                onValueChange={v => setClientForm({ ...clientForm, status: (v || 'active') as Client['status'] })}
              >
                <SelectTrigger id="c_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">🟢 Active</SelectItem>
                  <SelectItem value="inactive">🔴 Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c_start_date">Start Date</Label>
              <Input
                id="c_start_date"
                type="date"
                value={clientForm.start_date}
                onChange={e => setClientForm({ ...clientForm, start_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_address">Physical Address</Label>
            <Textarea
              id="c_address"
              placeholder="Building, street name, city, country..."
              value={clientForm.address}
              onChange={e => setClientForm({ ...clientForm, address: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c_content_plan">Content Plan Link (Google Sheets / Drive)</Label>
            <Input
              id="c_content_plan"
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={clientForm.content_plan_link}
              onChange={e => setClientForm({ ...clientForm, content_plan_link: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => setClientModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── PROJECT CREATE / EDIT MODAL ── */}
      <Modal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        title={modalMode === 'create' ? 'Add New Project' : 'Edit Project Details'}
      >
        <form onSubmit={handleProjectSubmit} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-2.5 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p_client">Link to Client *</Label>
            <Select
              value={projectForm.client_id}
              onValueChange={v => setProjectForm({ ...projectForm, client_id: v || '' })}
            >
              <SelectTrigger id="p_client">
                <SelectValue placeholder="— Select Client —" />
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
            <Label htmlFor="p_name">Project Name *</Label>
            <Input
              id="p_name"
              placeholder="e.g. Q3 SEO Optimization"
              value={projectForm.name}
              onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p_desc">Project Description</Label>
            <Textarea
              id="p_desc"
              placeholder="Describe targets, deliverables, details..."
              value={projectForm.description}
              onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p_status">Status</Label>
            <Select
              value={projectForm.status}
              onValueChange={v => setProjectForm({ ...projectForm, status: v as Project['status'] })}
            >
              <SelectTrigger id="p_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">📝 Planning</SelectItem>
                <SelectItem value="active">⚡ Active</SelectItem>
                <SelectItem value="on_hold">🔄 On Hold</SelectItem>
                <SelectItem value="completed">✅ Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p_start">Start Date</Label>
              <Input
                id="p_start"
                type="date"
                value={projectForm.start_date}
                onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p_end">End Date / Deadline</Label>
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
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Project'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

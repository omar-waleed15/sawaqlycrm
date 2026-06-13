'use client';

import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { clientsApi, projectsApi, tasksApi } from '@/lib/api';
import { Client, Project, Task } from '@/types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/lib/i18n';
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
  CheckCircle2,
  Clock,
  CircleDot,
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

function getTaskOverallStatus(task: Task, t: any): { label: string; className: string; icon: typeof CheckCircle2 } {
  if (!task.task_assignees || task.task_assignees.length === 0) {
    return { label: t('status.todo'), className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: CircleDot };
  }
  const allCompleted = task.task_assignees.every(a => a.status === 'completed');
  if (allCompleted) {
    return { label: t('status.completed'), className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', icon: CheckCircle2 };
  }
  const anyInProgress = task.task_assignees.some(a => a.status === 'in_progress' || a.status === 'submitted');
  if (anyInProgress) {
    return { label: t('status.in_progress'), className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Clock };
  }
  return { label: t('status.todo'), className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: CircleDot };
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

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/* ─── Inline Task Table Component ─── */
function ProjectTasksTable({ projectTasks }: { projectTasks: Task[] }) {
  const { t, locale } = useLanguage();

  if (projectTasks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic py-3 ps-2">
        {t('clients.noTasksLinked')}
      </p>
    );
  }

  return (
    <div className="border rounded-lg bg-background overflow-hidden">
      <div className="table-responsive">
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr className="text-xs text-muted-foreground bg-muted/20">
              <th className="py-2.5 px-4 font-bold text-start">{t('clients.taskTitle')}</th>
              <th className="py-2.5 px-4 font-bold text-start">{t('clients.assignees')}</th>
              <th className="py-2.5 px-4 font-bold text-start">{t('tasks.dueDate')}</th>
              <th className="py-2.5 px-4 font-bold text-start">{t('clients.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {projectTasks.map(tTask => {
              const overall = getTaskOverallStatus(tTask, t);
              const StatusIcon = overall.icon;
              return (
                <tr key={tTask.id} className="text-xs hover:bg-muted/5 transition-colors">
                  <td className="py-3 px-4 font-semibold text-foreground text-start">
                    <a
                      href={`/dashboard/tasks/${tTask.id}`}
                      className="hover:underline hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {tTask.title}
                    </a>
                  </td>
                  <td className="py-3 px-4 text-start">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {tTask.task_assignees && tTask.task_assignees.length > 0 ? (
                        tTask.task_assignees.map(a => {
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
                        <span className="text-muted-foreground italic text-[10px]">{t('common.unassigned')}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-start">
                    {tTask.due_date ? formatDate(tTask.due_date, locale) : t('taskDetail.noDueDate')}
                  </td>
                  <td className="py-3 px-4 text-start">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${overall.className}`}>
                      <StatusIcon className="size-3" />
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
  );
}

/* ─── Completion Badge Component ─── */
function CompletionBadge({ rate, total }: { rate: number; total: number }) {
  const { t } = useLanguage();
  const color =
    rate >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
    rate >= 50 ? 'text-blue-600 dark:text-blue-400' :
    rate > 0 ? 'text-amber-600 dark:text-amber-400' :
    'text-muted-foreground';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            rate >= 100 ? 'bg-emerald-500' :
            rate >= 50 ? 'bg-blue-500' :
            rate > 0 ? 'bg-amber-500' : 'bg-muted-foreground/20'
          }`}
          style={{ width: `${rate}%` }}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums ${color}`}>{rate}%</span>
      <span className="text-[10px] text-muted-foreground">({total} {t('common.tasks')})</span>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<'clients' | 'projects'>('clients');
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
          ) : (
            <Button onClick={() => { resetProjectForm(); setProjectModalOpen(true); }} disabled={clients.length === 0}>
              <Plus className="size-4 mr-2 rtl:ml-2 rtl:mr-0" /> {t('clients.createProject')}
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

              {/* Clients Cards/Rows */}
              <div className="flex flex-col gap-3">
                {filteredClients.map(c => {
                  const clientProjects = projects.filter(p => p.client_id === c.id);
                  const isExpanded = expandedClientId === c.id;

                  // Aggregate project tasks for this client
                  const allClientTasks = clientProjects.flatMap(p => getProjectTasks(p.id));
                  const clientCompletionRate = getCompletionRate(allClientTasks);

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
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 flex-1">
                            <div>
                              <h3 className="text-sm font-bold text-foreground leading-tight">{c.name}</h3>
                              <p className="text-xs text-muted-foreground truncate">{c.company || t('clients.privateClient')}</p>
                            </div>
                            <div className="text-xs text-muted-foreground self-center text-start">
                              {c.email && <div>📧 {c.email}</div>}
                              {c.phone && <div>📞 {c.phone}</div>}
                            </div>
                            <div className="self-center">
                              {allClientTasks.length > 0 && (
                                <CompletionBadge rate={clientCompletionRate} total={allClientTasks.length} />
                              )}
                            </div>
                            <div className="flex gap-2 items-center md:justify-end">
                              <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                                {c.status === 'active' ? t('clients.active') : t('clients.inactive')}
                              </Badge>
                              <Badge variant="outline">
                                {clientProjects.length} {t('clients.projects')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="pl-4 rtl:pl-0 rtl:pr-4">
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
                                👥 {t('clients.contactDetails')}
                              </h4>
                              <div className="text-sm space-y-1 text-start">
                                <div className="font-semibold">{c.name}</div>
                                {c.company && <div className="text-muted-foreground">{c.company}</div>}
                                {c.email && <div className="text-muted-foreground truncate">{c.email}</div>}
                                {c.phone && <div className="text-muted-foreground">{c.phone}</div>}
                              </div>
                              <div className="flex gap-2 justify-end mt-2 pt-2 border-t">
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); resetClientForm(c); setClientModalOpen(true); }}>
                                  <Edit className="size-3 mr-1 rtl:ml-1 rtl:mr-0" /> {t('common.edit')}
                                </Button>
                                <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDeleteClient(c.id, c.name); }}>
                                  <Trash2 className="size-3 mr-1 rtl:ml-1 rtl:mr-0" /> {t('common.delete')}
                                </Button>
                              </div>
                            </div>

                            <div className="bg-background border rounded-lg p-4 flex flex-col gap-2.5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <MapPin className="size-3.5" /> {t('clients.addressTimeline')}
                              </h4>
                              <div className="text-sm space-y-2 text-start">
                                <div className="flex gap-1.5 items-start">
                                  <span className="text-xs text-muted-foreground font-semibold shrink-0">{t('clients.startDate')}</span>
                                  <span>{c.start_date ? formatDate(c.start_date, locale) : t('clients.notSpecified')}</span>
                                </div>
                                <div className="flex gap-1.5 items-start">
                                  <span className="text-xs text-muted-foreground font-semibold shrink-0">{t('clients.address')}</span>
                                  <span className="text-muted-foreground whitespace-pre-line leading-snug">
                                    {c.address || t('clients.noAddress')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-background border rounded-lg p-4 flex flex-col gap-2.5">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                  📁 {t('clients.deliverables')}
                                </h4>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={(e) => { e.stopPropagation(); openProgressModal(c); }}
                                >
                                  <BarChart3 className="size-3 mr-1 rtl:ml-1 rtl:mr-0" /> {t('clients.updateProgress')}
                                </Button>
                              </div>
                              <div className="text-sm space-y-2.5 flex-1 flex flex-col justify-between">
                                {/* Content deliverable progress */}
                                <div className="grid grid-cols-4 gap-2">
                                  {[
                                    { label: t('clients.posts'), done: c.done_posts ?? 0, total: c.num_posts ?? 0 },
                                    { label: t('clients.reels'), done: c.done_reels ?? 0, total: c.num_reels ?? 0 },
                                    { label: t('clients.stories'), done: c.done_stories ?? 0, total: c.num_stories ?? 0 },
                                    { label: t('clients.photos'), done: c.done_photos ?? 0, total: c.num_photos ?? 0 },
                                  ].map(item => {
                                    const pct = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
                                    const isComplete = item.total > 0 && item.done >= item.total;
                                    return (
                                      <div key={item.label} className="text-center bg-muted/30 rounded-md py-2.5 px-1 relative overflow-hidden">
                                        {item.total > 0 && (
                                          <div
                                            className={`absolute bottom-0 left-0 h-1 rounded-full transition-all duration-500 ${
                                              isComplete ? 'bg-emerald-500' : pct > 0 ? 'bg-indigo-500' : 'bg-transparent'
                                            }`}
                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                          />
                                        )}
                                        <div className={`text-base font-bold tabular-nums ${
                                          isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                                        }`}>
                                          {item.done}/{item.total}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground font-semibold">{item.label}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* Others row */}
                                {c.other_deliverables && (
                                  <div className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2">
                                    <span className="text-xs text-muted-foreground text-start">
                                      <span className="font-semibold">{t('clients.others')}</span> {c.other_deliverables}
                                    </span>
                                    <span className={`text-xs font-bold ${
                                      c.done_other ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                                    }`}>
                                      {c.done_other ? '1/1 ✓' : '0/1'}
                                    </span>
                                  </div>
                                )}

                                {/* Content Plan link */}
                                {c.content_plan_link ? (
                                  <a
                                    href={c.content_plan_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-xs transition-colors border border-indigo-200 dark:border-indigo-800/40 w-fit"
                                  >
                                    {t('clients.openContentPlan')} <ExternalLink className="size-3" />
                                  </a>
                                ) : (
                                  <div className="text-muted-foreground italic text-xs text-start">
                                    {t('clients.noContentPlan')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Client Projects with inline expandable tasks */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Briefcase className="size-3.5" /> {t('clients.projects')} ({clientProjects.length})
                              </h4>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resetProjectForm(undefined, c.id);
                                  setProjectModalOpen(true);
                                }}
                              >
                                <Plus className="size-3 mr-1 rtl:ml-1 rtl:mr-0" /> {t('clients.newProject')}
                              </Button>
                            </div>
                            {clientProjects.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {clientProjects.map(p => {
                                  const cfg = PROJECT_STATUS_CONFIG[p.status] || PROJECT_STATUS_CONFIG.planning;
                                  const pTasks = getProjectTasks(p.id);
                                  const rate = getCompletionRate(pTasks);
                                  const isProjExpanded = expandedProjectId === p.id;

                                  return (
                                    <div key={p.id} className="border rounded-lg bg-background overflow-hidden">
                                      {/* Project header row */}
                                      <div
                                        onClick={() => setExpandedProjectId(isProjExpanded ? null : p.id)}
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors"
                                      >
                                        <div className="flex items-center gap-3 flex-1">
                                          <div className={`size-2 rounded-full shrink-0 ${
                                            p.status === 'active' ? 'bg-indigo-500' :
                                            p.status === 'completed' ? 'bg-emerald-500' :
                                            p.status === 'on_hold' ? 'bg-amber-500' : 'bg-slate-400'
                                          }`} />
                                          <div className="flex-1 min-w-0 text-start">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-semibold text-sm text-foreground">{p.name}</span>
                                              <Badge className={`${cfg.className} text-[10px] px-2 py-0`}>{t(cfg.labelKey)}</Badge>
                                            </div>
                                            {p.description && (
                                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-4 shrink-0">
                                            <CompletionBadge rate={rate} total={pTasks.length} />
                                            <div className="flex gap-1">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0"
                                                onClick={(e) => { e.stopPropagation(); resetProjectForm(p); setProjectModalOpen(true); }}
                                              >
                                                <Edit className="size-3" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id, p.name); }}
                                              >
                                                <Trash2 className="size-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="pl-3 rtl:pl-0 rtl:pr-3">
                                          {isProjExpanded ? (
                                            <ChevronUp className="size-4 text-muted-foreground" />
                                          ) : (
                                            <ChevronDown className="size-4 text-muted-foreground" />
                                          )}
                                        </div>
                                      </div>

                                      {/* Expanded project tasks */}
                                      {isProjExpanded && (
                                        <div className="border-t border-border bg-muted/5 p-4">
                                          <div className="flex items-center justify-between mb-3">
                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                              <ListTodo className="size-3.5" /> {t('common.tasks')} ({pTasks.length})
                                            </h5>
                                            {pTasks.length > 0 && (
                                              <div className="flex items-center gap-2 text-xs">
                                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                                  {pTasks.filter(tTask => tTask.task_assignees?.every(a => a.status === 'completed')).length} {t('status.completed')}
                                                </span>
                                                <span className="text-muted-foreground">·</span>
                                                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                                  {pTasks.filter(tTask => !tTask.task_assignees?.every(a => a.status === 'completed')).length} {t('status.in_progress')}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                          <ProjectTasksTable projectTasks={pTasks} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic pl-1 text-start">{t('clients.noProjects')}</p>
                            )}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
                {filteredClients.length === 0 && (
                  <div className="text-center py-10 border rounded-lg border-dashed text-muted-foreground text-sm">
                    {t('clients.noClientsFound')}
                  </div>
                )}
              </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-11 rtl:pl-0 rtl:pr-11">
                      {clientProjs.map(p => {
                        const cfg = PROJECT_STATUS_CONFIG[p.status] || PROJECT_STATUS_CONFIG.planning;
                        const pTasks = getProjectTasks(p.id);
                        const rate = getCompletionRate(pTasks);
                        const isProjExpanded = expandedProjectId === p.id;

                        return (
                          <Card key={p.id} className="relative overflow-hidden group hover:shadow-md transition-all duration-200 border border-border flex flex-col">
                            {/* Top accent line */}
                            <div className={`h-1.5 w-full ${
                              p.status === 'planning' ? 'bg-slate-400' :
                              p.status === 'active' ? 'bg-indigo-500' :
                              p.status === 'on_hold' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`} />

                            <CardContent className="p-5 flex flex-col gap-3 flex-1">
                              {/* Header */}
                              <div className="flex justify-between items-start gap-3">
                                <h3 className="font-bold text-sm text-foreground leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-start">
                                  {p.name}
                                </h3>
                                <Badge className={`${cfg.className} shrink-0 text-[10px] px-2 py-0`}>{t(cfg.labelKey)}</Badge>
                              </div>

                              {/* Description */}
                              {p.description ? (
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed text-start">{p.description}</p>
                              ) : (
                                <p className="text-xs text-muted-foreground/40 italic text-start">{t('taskDetail.noDescription')}</p>
                              )}

                              {/* Completion Rate */}
                              <div className="pt-2 border-t border-border/60">
                                <CompletionBadge rate={rate} total={pTasks.length} />
                              </div>

                              {/* Timeline */}
                              <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1"><Calendar className="size-3 text-indigo-500" /> {p.start_date ? formatDate(p.start_date, locale) : t('common.noData')}</span>
                                <span>—</span>
                                <span className="flex items-center gap-1 font-semibold text-foreground"><Calendar className="size-3 text-rose-500" /> {p.end_date ? formatDate(p.end_date, locale) : t('common.noData')}</span>
                              </div>

                              {/* Expand tasks button */}
                              <button
                                onClick={() => setExpandedProjectId(isProjExpanded ? null : p.id)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors pt-1"
                              >
                                {isProjExpanded ? <ChevronUp className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                                {isProjExpanded ? t('common.close') : `${t('common.view')} (${pTasks.length})`}
                              </button>

                              {/* Actions */}
                              <div className="flex gap-2 justify-end pt-2 border-t border-border/60">
                                <Button size="sm" variant="outline" onClick={() => { resetProjectForm(p); setProjectModalOpen(true); }} className="h-8 text-xs">
                                  <Edit className="size-3 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('common.edit')}
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteProject(p.id, p.name)} className="h-8 text-xs">
                                  <Trash2 className="size-3 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('common.delete')}
                                </Button>
                              </div>
                            </CardContent>

                            {/* Expanded task list below card */}
                            {isProjExpanded && (
                              <div className="border-t border-border bg-muted/5 p-4">
                                <ProjectTasksTable projectTasks={pTasks} />
                              </div>
                            )}
                          </Card>
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

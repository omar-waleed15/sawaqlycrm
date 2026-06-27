'use client';

import { Project, Task } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCairoDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  CircleDot,
  CheckCircle2,
  Clock,
  ListTodo
} from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  projectTasks: Task[];
  locale: string;
  t: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEditClick: (project: Project) => void;
  onDeleteClick: (projectId: string, projectName: string) => void;
}

const PROJECT_STATUS_CONFIG: Record<string, { labelKey: string; className: string; bgBarClass: string }> = {
  planning: { labelKey: 'clients.planning', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', bgBarClass: 'bg-slate-400' },
  active: { labelKey: 'clients.active', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300', bgBarClass: 'bg-indigo-500' },
  on_hold: { labelKey: 'clients.onHold', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', bgBarClass: 'bg-amber-500' },
  completed: { labelKey: 'status.completed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', bgBarClass: 'bg-emerald-500' },
};

function getTaskOverallStatus(task: Task, t: any): { label: string; className: string; icon: any } {
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

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/* ─── Inline Task Table Component ─── */
function ProjectTasksTable({ projectTasks, t, locale }: { projectTasks: Task[]; t: any; locale: string }) {
  if (projectTasks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic py-3 ps-2 text-start">
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
                  <td className="py-3 px-4 text-muted-foreground text-start text-xs whitespace-nowrap">
                    {tTask.due_date ? formatCairoDate(tTask.due_date, locale) : t('taskDetail.noDueDate')}
                  </td>
                  <td className="py-3 px-4 text-start">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap ${overall.className}`}>
                      <StatusIcon className="size-2.5" />
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

function getCompletionRate(projectTasks: Task[]): number {
  if (projectTasks.length === 0) return 0;
  const completed = projectTasks.filter(t => {
    if (!t.task_assignees || t.task_assignees.length === 0) return false;
    return t.task_assignees.every(a => a.status === 'completed');
  }).length;
  return Math.round((completed / projectTasks.length) * 100);
}

function formatDate(dateStr?: string, locale: string = 'en'): string {
  if (!dateStr) return 'N/A';
  return formatCairoDate(dateStr, locale);
}

function formatCurrency(amount: number, locale?: string): string {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
  return formatted.replace('US$', '$').replace('USD', '$').replace('دولار أمريكي', '$');
}

export default function ProjectCard({
  project,
  projectTasks,
  locale,
  t,
  isExpanded,
  onToggleExpand,
  onEditClick,
  onDeleteClick,
}: ProjectCardProps) {
  const cfg = PROJECT_STATUS_CONFIG[project.status] || PROJECT_STATUS_CONFIG.planning;
  const rate = getCompletionRate(projectTasks);
  const totalTasks = projectTasks.length;

  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 slide-up h-full flex flex-col bg-card"
      onClick={onToggleExpand}
    >
      <CardContent className="p-5 flex flex-col gap-3 flex-1">
        {/* Top Row: Status, Client Name & Budget Badges + Actions Menu */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className={cn("text-[10px] px-2 py-0.5 font-semibold shrink-0 uppercase tracking-wide", cfg.className)}>
              {t(cfg.labelKey)}
            </Badge>

            {project.budget !== undefined && project.budget > 0 && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-extrabold border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800/40 dark:text-emerald-400 dark:bg-emerald-950/20">
                💰 {formatCurrency(project.budget, locale)}
              </Badge>
            )}
          </div>

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 p-0 text-muted-foreground/70 hover:text-foreground hover:bg-muted rounded-full shrink-0 -mt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditClick(project); }}>
                <Pencil className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                onClick={(e) => { e.stopPropagation(); onDeleteClick(project.id, project.name); }}
              >
                <Trash2 className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title & Description */}
        <div className="flex flex-col text-start flex-1">
          <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-indigo-600 transition-colors">
            {project.name}
          </h3>
          {project.description ? (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1.5 break-words">
              {project.description}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/40 italic mt-1.5">
              {t('taskDetail.noDescription')}
            </p>
          )}
        </div>

        {/* Progress Tracker */}
        <div className="pt-2 border-t border-border/60">
          <div className="flex items-center justify-between mb-1.5 text-[10px] font-bold text-muted-foreground uppercase">
            <span>{t('taskTarget.progress') || 'Progress'}</span>
            <span className={cn(
              "text-xs font-extrabold tabular-nums",
              rate >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
              rate >= 50 ? 'text-indigo-600 dark:text-indigo-400' :
              rate > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
            )}>
              {rate}% ({totalTasks} {t('common.tasks')})
            </span>
          </div>
          <div className="h-2 bg-muted border rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", cfg.bgBarClass)}
              style={{ width: `${rate}%` }}
            />
          </div>
        </div>

        {/* Footer Area: Timeline & View Tasks Trigger */}
        <div className="mt-auto flex flex-col gap-2">
          <div className="h-px bg-border my-1" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground select-none gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 font-medium">
                <span>📅</span>
                <span>{formatDate(project.start_date, locale)}</span>
              </span>
              <span>—</span>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <span>🏁</span>
                <span>{formatDate(project.end_date, locale)}</span>
              </span>
            </div>

            {/* Expand Tasks Indicator */}
            <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors">
              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              <span>{isExpanded ? t('common.close') : `${t('common.view')} (${totalTasks})`}</span>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Expanded project tasks */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/5 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ListTodo className="size-3.5" /> {t('common.tasks')} ({totalTasks})
            </h5>
            {totalTasks > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {projectTasks.filter(tTask => tTask.task_assignees?.every(a => a.status === 'completed')).length} {t('status.completed')}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  {projectTasks.filter(tTask => !tTask.task_assignees?.every(a => a.status === 'completed')).length} {t('status.in_progress')}
                </span>
              </div>
            )}
          </div>
          <ProjectTasksTable projectTasks={projectTasks} t={t} locale={locale} />
        </div>
      )}
    </Card>
  );
}

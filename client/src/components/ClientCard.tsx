'use client';

import { Client, Task } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCairoDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
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
  Mail,
  Phone,
  MapPin,
  Calendar,
  ExternalLink,
  Briefcase,
  Sliders,
  Plus
} from 'lucide-react';

interface ClientCardProps {
  client: Client;
  clientTasks: Task[];
  locale: string;
  t: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEditClick: (client: Client) => void;
  onDeleteClick: (clientId: string, clientName: string) => void;
  onNewTaskClick: (clientId: string) => void;
}

function formatDate(dateStr?: string, locale: string = 'en'): string {
  if (!dateStr) return 'N/A';
  return formatCairoDate(dateStr, locale);
}

export default function ClientCard({
  client,
  clientTasks,
  locale,
  t,
  isExpanded,
  onToggleExpand,
  onEditClick,
  onDeleteClick,
  onNewTaskClick,
}: ClientCardProps) {
  const router = useRouter();

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md slide-up h-full flex flex-col bg-card border border-border/80 rounded-xl overflow-hidden"
      )}
    >
      <CardContent className="p-5 flex flex-col gap-4 flex-1">
        {/* Header Row: Avatar, Name/Company & Actions Dropdown */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-xs">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-start min-w-0">
              <h3 className="text-sm font-bold text-foreground leading-snug truncate" title={client.name}>
                {client.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate" title={client.company || t('clients.privateClient')}>
                {client.company || t('clients.privateClient')}
              </p>
            </div>
          </div>

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 p-0 text-muted-foreground/70 hover:text-foreground hover:bg-muted rounded-full shrink-0 -mt-1"
                >
                  <MoreVertical className="size-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditClick(client)}>
                <Pencil className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0 text-muted-foreground" />
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                onClick={() => onDeleteClick(client.id, client.name)}
              >
                <Trash2 className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status & Project Badges */}
        <div className="flex gap-2 items-center flex-wrap">
          <Badge variant={client.status === 'active' ? 'default' : 'secondary'} className="text-[10px] px-2 py-0.5 font-bold tracking-wide uppercase">
            {client.status === 'active' ? t('clients.active') : t('clients.inactive')}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-semibold bg-muted/30 text-muted-foreground">
            📋 {clientTasks.length} {t('tasks.title')}
          </Badge>
        </div>

        {/* Contact Info Section (Grouped Email, Phone, Address, Start Date) */}
        <div className="bg-muted/20 border border-border/40 rounded-lg p-3 flex flex-col gap-2 text-start">
          {client.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              <Mail className="size-3.5 shrink-0 text-indigo-500/80" />
              <span className="truncate" title={client.email}>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="size-3.5 shrink-0 text-indigo-500/80" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0 text-indigo-500/80 mt-0.5" />
              <span className="line-clamp-2 leading-tight" title={client.address}>{client.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="size-3.5 shrink-0 text-indigo-500/80" />
            <span>{t('clients.startDate')}: <strong className="text-foreground/90 font-semibold">{client.start_date ? formatDate(client.start_date, locale) : t('clients.notSpecified')}</strong></span>
          </div>
        </div>

        {/* Deliverables Tracker Section */}
        <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-start">
            🎬 {t('clients.deliverables')}
          </h4>
          <div className="grid grid-cols-2 gap-3 mt-1 text-start">
            {[
              { label: t('clients.posts'), done: client.done_posts ?? 0, total: client.num_posts ?? 0, color: 'bg-indigo-500' },
              { label: t('clients.reels'), done: client.done_reels ?? 0, total: client.num_reels ?? 0, color: 'bg-purple-500' },
              { label: t('clients.stories'), done: client.done_stories ?? 0, total: client.num_stories ?? 0, color: 'bg-pink-500' },
              { label: t('clients.photos'), done: client.done_photos ?? 0, total: client.num_photos ?? 0, color: 'bg-emerald-500' },
            ].map(item => {
              const pct = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
              const isComplete = item.total > 0 && item.done >= item.total;
              return (
                <div key={item.label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/80">
                    <span className="truncate">{item.label}</span>
                    <span className={cn("tabular-nums", isComplete && "text-emerald-600 dark:text-emerald-400 font-extrabold")}>
                      {item.done}/{item.total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden border border-border/20">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", item.color)}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Others Deliverables */}
          {client.other_deliverables && (
            <div className="flex items-center justify-between bg-muted/30 border border-border/30 rounded-md px-2.5 py-1.5 mt-1 text-xs">
              <span className="text-muted-foreground text-start truncate max-w-[200px]" title={client.other_deliverables}>
                <strong>{t('clients.others')}:</strong> {client.other_deliverables}
              </span>
              <span className={cn("font-bold shrink-0", client.done_other ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                {client.done_other ? "1/1 ✓" : "0/1"}
              </span>
            </div>
          )}

          {/* Content Plan Link Button */}
          {client.content_plan_link ? (
            <a
              href={client.content_plan_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 mt-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-xs transition-colors border border-indigo-200/50 dark:border-indigo-800/40 w-full"
            >
              {t('clients.openContentPlan')} <ExternalLink className="size-3" />
            </a>
          ) : (
            <div className="text-muted-foreground/60 italic text-xs py-1.5 border border-dashed rounded-lg mt-2 text-center bg-muted/10">
              {t('clients.noContentPlan')}
            </div>
          )}
        </div>

        {/* Footer Area: View Tasks Action */}
        <div className="mt-auto pt-2">
          <div className="h-px bg-border/60 my-2" />
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="flex items-center justify-between w-full text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors py-1 select-none"
          >
            <div className="flex items-center gap-1.5">
              <Sliders className="size-3.5" />
              <span>{t('tasks.activeTasks')} ({clientTasks.filter(tData => {
                const allCompleted = tData.task_assignees && tData.task_assignees.length > 0 && tData.task_assignees.every(a => a.status === 'completed');
                return !allCompleted;
              }).length})</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{isExpanded ? t('common.close') : t('common.view')}</span>
              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </div>
          </button>
        </div>
      </CardContent>

      {/* Expanded Tasks list drawer */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/10 p-4 flex flex-col gap-3 text-start" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">📋 Client Tasks</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-background"
              onClick={() => onNewTaskClick(client.id)}
            >
              <Plus className="size-3.5 mr-1 rtl:ml-1 rtl:mr-0 text-indigo-500" /> {t('tasks.createTask')}
            </Button>
          </div>

          {clientTasks.length > 0 ? (
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
              {clientTasks.map(tData => {
                const allCompleted = tData.task_assignees && tData.task_assignees.length > 0 && tData.task_assignees.every(a => a.status === 'completed');
                return (
                  <div
                    key={tData.id}
                    onClick={() => router.push(`/dashboard/tasks/${tData.id}`)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background hover:bg-muted/30 transition cursor-pointer text-xs animate-in fade-in"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className={cn("font-semibold text-foreground truncate", allCompleted && "line-through text-muted-foreground/60")}>
                        {tData.title}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {tData.due_date && (
                          <span className="text-[10px] text-muted-foreground">
                            📅 {tData.due_date.split('T')[0]}
                          </span>
                        )}
                        {tData.is_deliverable && (
                          <span className="text-[9px] font-bold text-indigo-500 uppercase">
                            🎯 {tData.deliverable_type}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-semibold",
                      allCompleted
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    )}>
                      {allCompleted ? t('status.completed') : t('status.todo')}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/75 italic py-3 text-center border border-dashed rounded-lg bg-background/50">
              {t('tasks.noMyTasks')}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

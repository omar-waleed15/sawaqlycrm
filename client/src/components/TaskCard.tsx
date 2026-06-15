'use client';

import { useRouter } from 'next/navigation';
import { Task, TaskAssignee } from '@/types';
import { PriorityBadge } from './Badges';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

interface TaskCardProps {
  task: Task;
  onScheduleClick?: (task: Task) => void;
}

function formatDate(dateStr?: string, locale: string = 'en'): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr?: string, assignees?: TaskAssignee[]): boolean {
  if (!dateStr) return false;
  const allCompleted = assignees?.every(a => a.status === 'completed');
  if (allCompleted) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function TaskCard({ task, onScheduleClick }: TaskCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const assignees = task.task_assignees || [];
  const overdue = isOverdue(task.due_date, assignees);
  const myAssignment = task.task_assignees?.find(a => a.user_id === user?.id);
  const isOwner = user?.role === 'owner' || (
    (user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager') &&
    !myAssignment
  );

  const submittedCount = assignees.filter(a => a.status === 'submitted').length;
  const totalAssignees = assignees.length;

  const handleClick = () => {
    if (onScheduleClick) {
      onScheduleClick(task);
    } else {
      router.push(`/dashboard/tasks/${task.id}`);
    }
  };

  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 slide-up"
      onClick={handleClick}
    >
      <CardContent className="p-4 flex flex-col gap-4">
        {/* Top/Content Section */}
        <div className="flex items-start justify-between gap-4">
          {/* Left: Title & Description */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-snug break-words">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1.5 break-words">
                {task.description}
              </p>
            )}
          </div>

          {/* Right: Priority & Due Date */}
          <div className="flex flex-col items-end gap-1.5 shrink-0 select-none">
            <div className="flex items-center gap-1.5">
              {task.content_type && (
                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 uppercase tracking-wide font-medium py-0 px-1.5 h-5 flex items-center justify-center">
                  📦 {t(`contentType.${task.content_type}`)}
                </Badge>
              )}
              <PriorityBadge priority={task.priority} />
            </div>
            {task.due_date && (
              <div className={cn('flex items-center gap-1 text-[11px] select-none shrink-0', overdue ? 'text-rose-600 font-bold' : 'text-muted-foreground')}>
                <span>📅</span>
                <span>{overdue ? `${t('common.overdue')} · ` : ''}{formatDate(task.due_date, locale)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Widgets Section */}
        {(isOwner && submittedCount > 0) || task.publish_date ? (
          <div className="flex flex-col gap-2 empty:hidden">
            {/* Submission progress for admin */}
            {isOwner && submittedCount > 0 && (
              <div className="bg-violet-50 dark:bg-violet-950/20 border-s-2 border-violet-400 rounded px-3 py-1.5 text-xs text-violet-800 dark:text-violet-300 font-semibold">
                📤 {t('tasks.submissionsPending', { count: submittedCount })}
              </div>
            )}

            {/* Publish Date Badge */}
            {task.publish_date && (
              <div className="flex flex-col gap-1 border-t border-dashed border-border pt-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded px-2 py-0.5 w-fit">
                  📢 {t('tasks.publish')} {formatDate(task.publish_date, locale)}
                </span>
                {task.publish_notes && (
                  <p className="text-xs text-muted-foreground italic line-clamp-2 leading-relaxed mt-0.5 ps-1">
                    📝 {task.publish_notes}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Bottom/Footer Section */}
        <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
          {/* Creator Profile */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider shrink-0 select-none">{t('tasks.from')}</span>
            <span className="text-xs text-muted-foreground font-medium truncate" title={task.creator?.name || 'Unknown'}>
              {task.creator?.name || 'Unknown'}
            </span>
          </div>


          {/* Assignees stacked avatar group */}
          <div className="flex items-center shrink-0">
            {totalAssignees > 0 ? (
              <div className="flex items-center">
                <div className="flex -space-x-1.5">
                  {assignees.slice(0, 3).map(a => (
                    a.user?.avatar_url ? (
                      <img
                        key={a.id}
                        src={a.user.avatar_url}
                        alt={a.user.name}
                        className="size-6 rounded-full object-cover shrink-0 border-2 border-white dark:border-slate-900"
                        title={a.user.name}
                      />
                    ) : (
                      <div
                        key={a.id}
                        className="size-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0 border-2 border-white dark:border-slate-900 uppercase"
                        title={a.user?.name || 'Assigned Member'}
                      >
                        {a.user ? getInitials(a.user.name) : '?'}
                      </div>
                    )
                  ))}
                </div>
                {totalAssignees > 3 && (
                  <span className="text-[10px] text-muted-foreground font-semibold ml-1 select-none">
                    +{totalAssignees - 3}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground select-none">{t('common.unassigned')}</span>
            )}
          </div>
        </div>

        {/* Schedule Action Button */}
        {onScheduleClick && isOwner && !task.publish_date && (
          <div className="mt-3 pt-3 border-t border-dashed border-border">
            <span className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-md py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 transition-colors">
              🗓️ {t('tasks.clickToSchedule')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


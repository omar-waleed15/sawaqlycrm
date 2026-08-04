'use client';

import { Badge } from '@/components/ui/badge';
import { Priority, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

const priorityConfig: Record<Priority, { className: string }> = {
  urgent: { className: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-950/60' },
  high:   { className: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900/60 hover:bg-orange-100 dark:hover:bg-orange-950/60' },
  medium: { className: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/60 hover:bg-amber-100 dark:hover:bg-amber-950/60' },
  low:    { className: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-950/60' },
};

const priorityDot: Record<Priority, string> = {
  urgent: 'bg-rose-500',
  high:   'bg-orange-500',
  medium: 'bg-yellow-500',
  low:    'bg-green-500',
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const { t } = useLanguage();
  const config = priorityConfig[priority] || priorityConfig.medium;
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-semibold text-xs', config.className, className)}>
      <span className={cn('size-1.5 rounded-full', priorityDot[priority] || priorityDot.medium)} />
      {t(`priority.${priority}`)}
    </Badge>
  );
}

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

const statusConfig: Record<TaskStatus, { className: string }> = {
  todo:        { className: 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800' },
  in_progress: { className: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-950/60' },
  submitted:   { className: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-950/60' },
  revision:    { className: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900/60 hover:bg-orange-100 dark:hover:bg-orange-950/60' },
  completed:   { className: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/60 hover:bg-purple-100 dark:hover:bg-purple-950/60' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useLanguage();
  const config = statusConfig[status] || statusConfig.todo;
  return (
    <Badge variant="outline" className={cn('font-semibold text-xs', config.className, className)}>
      {t(`status.${status}`)}
    </Badge>
  );
}


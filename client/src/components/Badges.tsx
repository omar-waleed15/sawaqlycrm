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
  urgent: { className: 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100' },
  high:   { className: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100' },
  medium: { className: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100' },
  low:    { className: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' },
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
  todo:        { className: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100' },
  in_progress: { className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' },
  submitted:   { className: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' },
  revision:    { className: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100' },
  completed:   { className: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100' },
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


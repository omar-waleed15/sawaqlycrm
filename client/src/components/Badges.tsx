'use client';

import { Badge } from '@/components/ui/badge';
import { Priority, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100' },
  high:   { label: 'High',   className: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100' },
  medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100' },
  low:    { label: 'Low',    className: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' },
};

const priorityDot: Record<Priority, string> = {
  urgent: 'bg-rose-500',
  high:   'bg-orange-500',
  medium: 'bg-yellow-500',
  low:    'bg-green-500',
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority] || priorityConfig.medium;
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-semibold text-xs', config.className, className)}>
      <span className={cn('size-1.5 rounded-full', priorityDot[priority] || priorityDot.medium)} />
      {config.label}
    </Badge>
  );
}

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  todo:        { label: 'To Do',          className: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100' },
  in_progress: { label: 'In Progress',    className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' },
  submitted:   { label: 'Submitted',      className: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' },
  revision:    { label: 'Needs Revision', className: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100' },
  completed:   { label: 'Completed',      className: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.todo;
  return (
    <Badge variant="outline" className={cn('font-semibold text-xs', config.className, className)}>
      {config.label}
    </Badge>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { Task } from '@/types';
import { PriorityBadge, StatusBadge } from './Badges';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onScheduleClick?: (task: Task) => void;
}

const priorityAccents: Record<string, string> = {
  urgent: 'border-l-rose-500',
  high:   'border-l-orange-500',
  medium: 'border-l-yellow-400',
  low:    'border-l-green-500',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr?: string, status?: string): boolean {
  if (!dateStr || status === 'completed') return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function TaskCard({ task, onScheduleClick }: TaskCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const overdue = isOverdue(task.due_date, task.status);
  const isOwner = user?.role === 'owner' || user?.role === 'team_leader';

  const handleClick = () => {
    if (onScheduleClick) {
      onScheduleClick(task);
    } else {
      router.push(`/dashboard/tasks/${task.id}`);
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-l-4 slide-up',
        priorityAccents[task.priority] || 'border-l-indigo-500'
      )}
      onClick={handleClick}
    >
      <CardHeader className="pb-2 flex-row items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground leading-snug flex-1">{task.title}</h3>
        <StatusBadge status={task.status} />
      </CardHeader>

      <CardContent className="pt-0 flex flex-col gap-3">
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Progress Update for Admin */}
        {isOwner && task.progress_note && (
          <div className="bg-blue-50 border-l-2 border-blue-400 rounded px-3 py-2 text-xs text-blue-800">
            <span className="font-bold text-blue-700 flex items-center gap-1 mb-1">
              ⚡ Latest Progress Update
            </span>
            <p className="italic line-clamp-2 leading-relaxed">
              &ldquo;{task.progress_note}&rdquo;
            </p>
          </div>
        )}

        {/* Publish Date Badge */}
        <div className="border-t border-dashed border-border pt-2">
          {task.publish_date ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
              📢 Publish: {formatDate(task.publish_date)}
            </span>
          ) : onScheduleClick ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted border border-dashed border-border rounded px-2 py-0.5">
              🗓️ Click to schedule
            </span>
          ) : null}
          {task.publish_date && task.publish_notes && (
            <p className="text-xs text-muted-foreground italic line-clamp-2 leading-relaxed mt-1">
              📝 {task.publish_notes}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-1.5">
            {task.assignee ? (
              <>
                <div className="size-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {getInitials(task.assignee.name)}
                </div>
                <span className="text-xs text-muted-foreground font-medium">{task.assignee.name}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Unassigned</span>
            )}
          </div>

          {task.due_date && (
            <div className={cn('flex items-center gap-1 text-xs', overdue ? 'text-rose-600 font-semibold' : 'text-muted-foreground')}>
              <span>📅</span>
              {overdue ? 'Overdue · ' : ''}{formatDate(task.due_date)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

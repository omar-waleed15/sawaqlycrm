'use client';

import { useRouter } from 'next/navigation';
import { Task, TaskAssignee } from '@/types';
import { PriorityBadge, StatusBadge } from './Badges';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const assignees = task.task_assignees || [];
  const overdue = isOverdue(task.due_date, assignees);
  const isOwner = user?.role === 'owner' || user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager';

  // For members, find their own assignment status
  const myAssignment = assignees.find(a => a.user_id === user?.id);

  const completedCount = assignees.filter(a => a.status === 'completed').length;
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
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-l-4 slide-up',
        priorityAccents[task.priority] || 'border-l-indigo-500'
      )}
      onClick={handleClick}
    >
      <CardHeader className="pb-2 flex-row items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground leading-snug flex-1">{task.title}</h3>
        {/* For members: show their own status. For admins: show progress */}
        {!isOwner && myAssignment ? (
          <StatusBadge status={myAssignment.status} />
        ) : totalAssignees > 0 ? (
          <Badge variant="outline" className="text-[10px] shrink-0 bg-indigo-50 text-indigo-700 border-indigo-200">
            {completedCount}/{totalAssignees} done
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] shrink-0">Unassigned</Badge>
        )}
      </CardHeader>

      <CardContent className="pt-0 flex flex-col gap-3">
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Submission progress for admin */}
        {isOwner && submittedCount > 0 && (
          <div className="bg-violet-50 border-l-2 border-violet-400 rounded px-3 py-1.5 text-xs text-violet-800 font-semibold">
            📤 {submittedCount} submission{submittedCount !== 1 ? 's' : ''} pending review
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
          {/* Stacked avatar group */}
          <div className="flex items-center gap-1.5">
            {totalAssignees > 0 ? (
              <div className="flex items-center">
                <div className="flex -space-x-2">
                  {assignees.slice(0, 3).map(a => (
                    <div
                      key={a.id}
                      className="size-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0 border-2 border-white"
                      title={a.user?.name}
                    >
                      {a.user ? getInitials(a.user.name) : '?'}
                    </div>
                  ))}
                </div>
                {totalAssignees > 3 && (
                  <span className="text-[10px] text-muted-foreground font-semibold ml-1.5">
                    +{totalAssignees - 3}
                  </span>
                )}
                {totalAssignees <= 2 && (
                  <span className="text-xs text-muted-foreground font-medium ml-2">
                    {assignees.map(a => a.user?.name).filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
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

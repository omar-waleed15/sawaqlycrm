import { Task } from '@/types';

/**
 * Smart active task sorting helper.
 * Pushes tasks requiring Review ('submitted') or Revision ('revision') to the top,
 * followed by standard active tasks ('in_progress', 'todo').
 * Within each tier, sorts by latest activity timestamp (updated_at / created_at DESC).
 */
export function sortActiveTasks(tasks: Task[], currentUserId?: string): Task[] {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];

  return [...tasks].sort((a, b) => {
    const getTaskPriorityScore = (task: Task): number => {
      const assignees = task.task_assignees || [];
      if (assignees.length === 0) return 2; // Default active

      const hasSubmitted = assignees.some(as => as.status === 'submitted');
      const hasRevision = assignees.some(as => as.status === 'revision');

      // Top Priority (Score 1): Tasks needing admin review or member revision
      if (hasSubmitted || hasRevision) return 1;

      // Active Work (Score 2): Tasks in progress or to-do
      const hasInProgress = assignees.some(as => as.status === 'in_progress');
      if (hasInProgress) return 2;

      const allCompleted = assignees.every(as => as.status === 'completed');
      if (allCompleted) return 3; // Finished

      return 2;
    };

    const scoreA = getTaskPriorityScore(a);
    const scoreB = getTaskPriorityScore(b);

    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }

    // Secondary Sort: Latest activity timestamp DESC
    const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });
}

import { supabaseAdmin } from './supabase';

export async function populateDynamicDeliverables(clients: any[]): Promise<any[]> {
  if (!clients || clients.length === 0) return [];

  const clientIds = clients.map(c => c.id);

  // Get start of the current month (YYYY-MM-01)
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  // Fetch all completed tasks for these clients in the current month
  const { data: tasks, error } = await supabaseAdmin
    .from('tasks')
    .select(`
      id,
      client_id,
      is_deliverable,
      deliverable_type,
      deliverable_month,
      task_assignees(status)
    `)
    .in('client_id', clientIds)
    .eq('is_deliverable', true)
    .eq('deliverable_month', startOfMonth);

  if (error) {
    console.error('Error fetching dynamic deliverables:', error.message);
    return clients;
  }

  // Initialize counts map
  const countsMap: Record<string, { posts: number; reels: number; stories: number; photos: number; otherDone: boolean }> = {};
  clientIds.forEach(cid => {
    countsMap[cid] = { posts: 0, reels: 0, stories: 0, photos: 0, otherDone: false };
  });

  // Calculate counts based on task assignee completions
  (tasks || []).forEach((task: any) => {
    const assignees = task.task_assignees || [];
    const isCompleted = assignees.length > 0 && assignees.every((a: any) => a.status === 'completed');
    
    if (isCompleted) {
      const cid = task.client_id;
      const type = task.deliverable_type;
      
      if (countsMap[cid]) {
        if (type === 'post') countsMap[cid].posts++;
        else if (type === 'reel') countsMap[cid].reels++;
        else if (type === 'story') countsMap[cid].stories++;
        else if (type === 'photo') countsMap[cid].photos++;
        else if (type === 'other') countsMap[cid].otherDone = true;
      }
    }
  });

  // Map counts back to client objects
  return clients.map(client => {
    const counts = countsMap[client.id];
    if (counts) {
      return {
        ...client,
        done_posts: counts.posts,
        done_reels: counts.reels,
        done_stories: counts.stories,
        done_photos: counts.photos,
        done_other: counts.otherDone,
      };
    }
    return client;
  });
}

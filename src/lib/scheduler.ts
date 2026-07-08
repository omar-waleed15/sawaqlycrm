import { supabaseAdmin } from './supabase';

/**
 * Calculates the target date for a given year and month based on the original scheduled date string.
 * Keeps the same day of the month, but caps it at the last day of the month if necessary.
 */
export function getTargetDateForMonth(originalDateStr: string, year: number, month: number): string {
  if (!originalDateStr || !originalDateStr.includes('-')) return '';
  const parts = originalDateStr.split('-');
  const originalDay = parseInt(parts[2]);
  if (isNaN(originalDay)) return '';

  // Get the last day of the target month
  const daysInMonth = new Date(year, month, 0).getDate();
  const actualDay = Math.min(originalDay, daysInMonth);

  return `${year}-${String(month).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
}

/**
 * Automatically generates draft/todo deliverables outline tasks for a client for a specific target month.
 */
export async function generateMonthlyTasksForClient(client: any, year: number, month: number): Promise<void> {
  if (!client || !client.id || client.status !== 'active') return;

  let schedule = client.deliverables_schedule;
  if (typeof schedule === 'string') {
    try {
      schedule = JSON.parse(schedule);
    } catch {
      schedule = {};
    }
  }
  if (!schedule) {
    schedule = {};
  }

  const types = ['posts', 'reels', 'stories', 'photos'] as const;
  const typeMap: Record<typeof types[number], { label: string; field: string; type: string }> = {
    posts: { label: 'Post', field: 'num_posts', type: 'post' },
    reels: { label: 'Reel', field: 'num_reels', type: 'reel' },
    stories: { label: 'Story', field: 'num_stories', type: 'story' },
    photos: { label: 'Photo', field: 'num_photos', type: 'photo' },
  };

  const startOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;

  for (const tKey of types) {
    const config = typeMap[tKey];
    const targetCount = client[config.field] || 0;
    const itemDates = schedule[tKey] || [];

    // Only generate up to targetCount scheduled items
    for (let i = 0; i < targetCount; i++) {
      const originalDate = itemDates[i];
      if (!originalDate) continue; // If not configured, skip

      const targetDate = getTargetDateForMonth(originalDate, year, month);
      if (!targetDate) continue;

      // Check if a deliverable task already exists for this client, type, and target date
      const { data: existing, error: checkErr } = await supabaseAdmin
        .from('tasks')
        .select('id')
        .eq('client_id', client.id)
        .eq('is_deliverable', true)
        .eq('deliverable_type', config.type)
        .eq('due_date', targetDate)
        .limit(1);

      if (checkErr) {
        console.error(`Error checking existing tasks for client ${client.name}:`, checkErr.message);
        continue;
      }

      if (existing && existing.length > 0) {
        // Task outline already exists for this slot, skip creation
        continue;
      }

      // Create outline task
      const { error: insertErr } = await supabaseAdmin
        .from('tasks')
        .insert({
          title: `${config.label} Deliverable Outline`,
          description: `Auto-generated monthly outline task for ${config.label.toLowerCase()} deliverable.`,
          priority: 'medium',
          status: 'todo',
          due_date: targetDate,
          client_id: client.id,
          is_deliverable: true,
          deliverable_type: config.type,
          deliverable_month: startOfMonthStr,
        });

      if (insertErr) {
        console.error(`Error inserting outline task for client ${client.name}:`, insertErr.message);
      }
    }
  }
}

/**
 * Triggers task outline generation for all active clients for a specific target month.
 */
export async function triggerMonthlyTasksGeneration(year: number, month: number): Promise<void> {
  try {
    const { data: clients, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('status', 'active')
      .eq('pipeline_stage', 'won');

    if (error) {
      console.error('Error fetching clients for task generation:', error.message);
      return;
    }

    for (const client of (clients || [])) {
      await generateMonthlyTasksForClient(client, year, month);
    }
  } catch (err) {
    console.error('Failed to trigger monthly tasks generation:', err);
  }
}

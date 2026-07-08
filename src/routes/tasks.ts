import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOnly, ownerOrTeamLeader, ownerOrTeamLeaderOrSales } from '../middleware/roleCheck';

const router = Router();

// Helper: build task select query with assignees joined
const TASK_SELECT = `
  *,
  creator:profiles!tasks_creator_id_fkey(id, name, email, avatar_url),
  client:clients(id, name, company),
  task_assignees(
    id,
    user_id,
    status,
    submission_link,
    completion_note,
    feedback,
    rating,
    assigned_at,
    updated_at,
    total_time_spent,
    timer_started_at,
    user:profiles(id, name, email, avatar_url)
  ),
  attachments(id),
  comments(id)
`;

// Helper: check if user is admin/TL
function isTaskAdmin(role: string): boolean {
  return role === 'owner' || role === 'team_leader' || role === 'moderation' || role === 'account_manager';
}

// Helper: check if user is allowed to administer a specific task (must NOT be assigned to it if they are team_leader, moderation, or account_manager)
async function canAdministerTask(userId: string, role: string, taskId: string): Promise<boolean> {
  if (role === 'owner') return true;
  if (!['team_leader', 'moderation', 'account_manager'].includes(role)) return false;

  // Check if they are in the assignees list
  const { data, error } = await supabaseAdmin
    .from('task_assignees')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error checking task assignment for administration check:', error);
    return false;
  }

  // They can administer only if they are NOT in the assignees list
  return !data;
}

// GET /api/tasks — Get tasks (owner: all, member: assigned only)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, priority, assignee_id, archived, client_id } = req.query;
    const userRole = req.user!.role;
    const showArchived = archived === 'true' && userRole !== 'moderation';

    if (isTaskAdmin(userRole)) {
      // Admin/TL: see all tasks (optionally filter by assignee)
      let query = supabaseAdmin
        .from('tasks')
        .select(TASK_SELECT)
        .eq('is_archived', showArchived)
        .order('created_at', { ascending: false });

      if (priority) query = query.eq('priority', priority as string);
      if (client_id) query = query.eq('client_id', client_id as string);

      const { data, error } = await query;

      if (error) { res.status(500).json({ error: error.message }); return; }

      let tasks = data || [];

      // Filter by assignee_id if provided (check task_assignees array)
      if (assignee_id) {
        tasks = tasks.filter((t: any) =>
          t.task_assignees?.some((a: any) => a.user_id === assignee_id)
        );
      }

      // Filter by status if provided (check if any assignee matches)
      if (status) {
        tasks = tasks.filter((t: any) =>
          t.task_assignees?.some((a: any) => a.status === status)
        );
      }

      res.json({ tasks });
    } else {
      // Member: only see tasks they're assigned to (excluding archived tasks)
      const { data: assignments, error: aErr } = await supabaseAdmin
        .from('task_assignees')
        .select('task_id')
        .eq('user_id', req.user!.id);

      if (aErr) { res.status(500).json({ error: aErr.message }); return; }

      const taskIds = (assignments || []).map((a: any) => a.task_id);
      if (taskIds.length === 0) { res.json({ tasks: [] }); return; }

      let query = supabaseAdmin
        .from('tasks')
        .select(TASK_SELECT)
        .in('id', taskIds)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (priority) query = query.eq('priority', priority as string);
      if (client_id) query = query.eq('client_id', client_id as string);

      const { data, error } = await query;

      if (error) { res.status(500).json({ error: error.message }); return; }

      let tasks = data || [];

      // Filter by status (only the member's own assignment status)
      if (status) {
        tasks = tasks.filter((t: any) =>
          t.task_assignees?.some((a: any) => a.user_id === req.user!.id && a.status === status)
        );
      }

      res.json({ tasks });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/daily — Tasks due today
router.get('/daily', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    let query = supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .eq('due_date', today)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) { res.status(500).json({ error: error.message }); return; }

    let tasks = data || [];

    // Members: filter to only their assigned tasks
    if (!isTaskAdmin(req.user!.role)) {
      tasks = tasks.filter((t: any) =>
        t.task_assignees?.some((a: any) => a.user_id === req.user!.id)
      );
    }

    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily tasks' });
  }
});

// GET /api/tasks/stats — Dashboard stats
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const isAdmin = isTaskAdmin(req.user!.role);

    if (isAdmin) {
      // Admin: count unique active tasks
      const { data: tasks, error } = await supabaseAdmin
        .from('tasks')
        .select(`
          id,
          due_date,
          task_assignees(status)
        `)
        .eq('is_archived', false);

      if (error) { res.status(500).json({ error: error.message }); return; }

      let total = 0;
      let completed = 0;
      let inProgress = 0;
      let submitted = 0;
      let todo = 0;
      let overdue = 0;

      for (const t of (tasks || [])) {
        total++;
        const assignees = t.task_assignees || [];
        
        // Check if overdue
        const hasUncompleted = assignees.length === 0 || assignees.some((a: any) => a.status !== 'completed');
        if (t.due_date && t.due_date < today && hasUncompleted) {
          overdue++;
        }

        if (assignees.length === 0) {
          todo++;
          continue;
        }

        const allCompleted = assignees.every((a: any) => a.status === 'completed');
        const anyInProgress = assignees.some((a: any) => a.status === 'in_progress' || a.status === 'revision');
        const anySubmitted = assignees.some((a: any) => a.status === 'submitted');

        if (allCompleted) {
          completed++;
        } else if (anyInProgress) {
          inProgress++;
        } else if (anySubmitted) {
          submitted++;
        } else {
          todo++;
        }
      }

      res.json({ stats: { total, completed, inProgress, submitted, todo, overdue } });
    } else {
      // Member: only see stats for their own assignments
      const { data: assignments, error } = await supabaseAdmin
        .from('task_assignees')
        .select('status, task:tasks(due_date, is_archived)')
        .eq('user_id', req.user!.id);

      if (error) { res.status(500).json({ error: error.message }); return; }

      // Filter out archived tasks from stats calculations
      const items = (assignments || []).filter((a: any) => !a.task?.is_archived);
      const total = items.length;
      const completed = items.filter((a: any) => a.status === 'completed').length;
      const inProgress = items.filter((a: any) => a.status === 'in_progress' || a.status === 'revision').length;
      const submitted = items.filter((a: any) => a.status === 'submitted').length;
      const todo = items.filter((a: any) => a.status === 'todo').length;
      const overdue = items.filter((a: any) => {
        const dueDate = a.task?.due_date;
        return dueDate && dueDate < today && a.status !== 'completed';
      }).length;

      res.json({ stats: { total, completed, inProgress, submitted, todo, overdue } });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/tasks — Create a new task (owner, team leader or sales)
router.post('/', authMiddleware, ownerOrTeamLeaderOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, description, priority, due_date, assignee_ids, drive_link, content_type, content_description, publish_date, client_id, project_id, is_deliverable, deliverable_type, deliverable_month } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  try {
    // Create the task (shared fields only)
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .insert({
        title,
        description: description || null,
        priority: priority || 'medium',
        status: 'todo', // kept for backward compat, not used by app
        due_date: due_date || null,
        assignee_id: null, // deprecated
        creator_id: req.user!.id,
        drive_link: drive_link || null,
        content_type: content_type || null,
        content_description: content_description || null,
        publish_date: publish_date || null,
        client_id: client_id || null,
        project_id: project_id || null,
        is_deliverable: is_deliverable ?? false,
        deliverable_type: deliverable_type || null,
        deliverable_month: deliverable_month || null,
      })
      .select('*')
      .single();

    if (taskError) { res.status(500).json({ error: taskError.message }); return; }

    // Insert assignees
    const ids: string[] = Array.isArray(assignee_ids) ? assignee_ids : (assignee_ids ? [assignee_ids] : []);
    if (ids.length > 0) {
      const rows = ids.map((uid: string) => ({
        task_id: task.id,
        user_id: uid,
        status: 'todo',
      }));

      const { error: assignError } = await supabaseAdmin
        .from('task_assignees')
        .insert(rows);

      if (assignError) {
        console.error('Failed to insert assignees:', assignError.message);
      }
    }

    // Re-fetch full task with assignees
    const { data: fullTask, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', task.id)
      .single();

    if (fetchError) { res.status(500).json({ error: fetchError.message }); return; }

    res.status(201).json({ task: fullTask });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /api/tasks/:id — Get task detail
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select(`
        *,
        creator:profiles!tasks_creator_id_fkey(id, name, email, avatar_url),
        task_assignees(
          id,
          user_id,
          status,
          submission_link,
          completion_note,
          feedback,
          rating,
          assigned_at,
          updated_at,
          total_time_spent,
          timer_started_at,
          user:profiles(id, name, email, avatar_url)
        ),
        attachments(*),
        comments(*, user:profiles(id, name, email, avatar_url))
      `)
      .eq('id', id)
      .single();

    if (error) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Members can only view tasks they're assigned to
    if (!isTaskAdmin(req.user!.role)) {
      const isAssigned = data.task_assignees?.some((a: any) => a.user_id === req.user!.id);
      if (!isAssigned) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    // Filter out comments older than 24 hours (fallback cleanup)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    if (data.comments) {
      const expiredIds = data.comments
        .filter((c: any) => c.created_at < twentyFourHoursAgo)
        .map((c: any) => c.id);

      // Delete expired comments in background
      if (expiredIds.length > 0) {
        supabaseAdmin
          .from('comments')
          .delete()
          .in('id', expiredIds)
          .then(() => {});
      }

      // Only return non-expired comments
      data.comments = data.comments.filter((c: any) => c.created_at >= twentyFourHoursAgo);
    }

    res.json({ task: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// PUT /api/tasks/:id — Update task (shared fields for admin, own assignment for members)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const admin = await canAdministerTask(req.user!.id, req.user!.role, id as string);

  try {
    // Verify task exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (admin) {
      // Admin: update shared task fields
      const { title, description, priority, due_date, drive_link, content_type, content_description, publish_date, publish_notes, assignee_ids, client_id, project_id, is_archived, is_deliverable, deliverable_type, deliverable_month } = req.body;

      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (priority !== undefined) updates.priority = priority;
      if (due_date !== undefined) updates.due_date = due_date;
      if (drive_link !== undefined) updates.drive_link = drive_link;
      if (content_type !== undefined) updates.content_type = content_type;
      if (content_description !== undefined) updates.content_description = content_description;
      if (publish_date !== undefined) updates.publish_date = publish_date;
      if (publish_notes !== undefined) updates.publish_notes = publish_notes;
      if (client_id !== undefined) updates.client_id = client_id || null;
      if (project_id !== undefined) updates.project_id = project_id || null;
      if (is_deliverable !== undefined) updates.is_deliverable = is_deliverable;
      if (deliverable_type !== undefined) updates.deliverable_type = deliverable_type;
      if (deliverable_month !== undefined) updates.deliverable_month = deliverable_month;
      if (is_archived !== undefined) {
        if (req.user!.role === 'moderation') {
          res.status(403).json({ error: 'Access denied. Moderators cannot archive or unarchive tasks.' });
          return;
        }
        updates.is_archived = is_archived;
      }
      updates.updated_at = new Date().toISOString();

      const { error: updateError } = await supabaseAdmin
        .from('tasks')
        .update(updates)
        .eq('id', id);

      if (updateError) { res.status(500).json({ error: updateError.message }); return; }

      // If assignee_ids provided, sync assignees
      if (assignee_ids !== undefined) {
        const newIds: string[] = Array.isArray(assignee_ids) ? assignee_ids : [];

        // Get current assignees
        const { data: currentAssignees } = await supabaseAdmin
          .from('task_assignees')
          .select('user_id')
          .eq('task_id', id);

        const currentIds = (currentAssignees || []).map((a: any) => a.user_id);
        const toAdd = newIds.filter(uid => !currentIds.includes(uid));
        const toRemove = currentIds.filter((uid: string) => !newIds.includes(uid));

        if (toRemove.length > 0) {
          await supabaseAdmin
            .from('task_assignees')
            .delete()
            .eq('task_id', id)
            .in('user_id', toRemove);
        }

        if (toAdd.length > 0) {
          const rows = toAdd.map(uid => ({ task_id: id, user_id: uid, status: 'todo' }));
          await supabaseAdmin.from('task_assignees').insert(rows);
        }
      }

      // If the admin is also an assignee and sent member-like fields, update their own assignment
      const { status, submission_link, completion_note } = req.body;
      if (status || submission_link !== undefined || completion_note !== undefined) {
        const { data: ownAssignment } = await supabaseAdmin
          .from('task_assignees')
          .select('*')
          .eq('task_id', id)
          .eq('user_id', req.user!.id)
          .maybeSingle();

        if (ownAssignment) {
          const assignUpdates: Record<string, unknown> = {};
          const allowedStatuses = ['todo', 'in_progress', 'submitted'];
          if (status && allowedStatuses.includes(status)) assignUpdates.status = status;
          if (submission_link !== undefined) assignUpdates.submission_link = submission_link;
          if (completion_note !== undefined) assignUpdates.completion_note = completion_note;
          assignUpdates.updated_at = new Date().toISOString();

          // Stop timer if transitioning out of active working statuses
          const activeStatuses = ['todo', 'in_progress', 'revision'];
          if (status && !activeStatuses.includes(status) && ownAssignment.timer_started_at) {
            const startTime = new Date(ownAssignment.timer_started_at).getTime();
            const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
            assignUpdates.total_time_spent = (ownAssignment.total_time_spent || 0) + elapsedSeconds;
            assignUpdates.timer_started_at = null;
          }

          await supabaseAdmin
            .from('task_assignees')
            .update(assignUpdates)
            .eq('id', ownAssignment.id);
        }
      }
    } else {
      // Member: check they're assigned
      const { data: assignment, error: aErr } = await supabaseAdmin
        .from('task_assignees')
        .select('*')
        .eq('task_id', id)
        .eq('user_id', req.user!.id)
        .single();

      if (aErr || !assignment) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Member can update their own assignment
      const { status, submission_link, completion_note } = req.body;
      const assignUpdates: Record<string, unknown> = {};
      const allowedStatuses = ['todo', 'in_progress', 'submitted'];
      if (status && allowedStatuses.includes(status)) assignUpdates.status = status;
      if (submission_link !== undefined) assignUpdates.submission_link = submission_link;
      if (completion_note !== undefined) assignUpdates.completion_note = completion_note;
      assignUpdates.updated_at = new Date().toISOString();

      // If status is transitioning out of active working statuses, stop the timer if active
      const activeStatuses = ['todo', 'in_progress', 'revision'];
      if (status && !activeStatuses.includes(status) && assignment.timer_started_at) {
        const startTime = new Date(assignment.timer_started_at).getTime();
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        assignUpdates.total_time_spent = (assignment.total_time_spent || 0) + elapsedSeconds;
        assignUpdates.timer_started_at = null;
      }

      const { error: updateError } = await supabaseAdmin
        .from('task_assignees')
        .update(assignUpdates)
        .eq('id', assignment.id);

      if (updateError) { res.status(500).json({ error: updateError.message }); return; }
    }

    // Re-fetch full task
    const { data: fullTask, error: reFetchError } = await supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', id)
      .single();

    if (reFetchError) { res.status(500).json({ error: reFetchError.message }); return; }

    res.json({ task: fullTask });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// POST /api/tasks/:id/assignees — Add an assignee to a task (admin/TL only)
router.post('/:id/assignees', authMiddleware, ownerOrTeamLeader, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }

  if (!(await canAdministerTask(req.user!.id, req.user!.role, id as string))) {
    res.status(403).json({ error: 'Access denied. You cannot administer this task if you are assigned to it.' });
    return;
  }

  try {
    const { error } = await supabaseAdmin
      .from('task_assignees')
      .insert({ task_id: id, user_id, status: 'todo' });

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'User is already assigned to this task' });
      } else {
        res.status(500).json({ error: error.message });
      }
      return;
    }

    // Re-fetch full task
    const { data: fullTask, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', id)
      .single();

    if (fetchError) { res.status(500).json({ error: fetchError.message }); return; }

    res.status(201).json({ task: fullTask });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add assignee' });
  }
});

// DELETE /api/tasks/:id/assignees/:userId — Remove an assignee (admin/TL only)
router.delete('/:id/assignees/:userId', authMiddleware, ownerOrTeamLeader, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id, userId } = req.params;

  if (!(await canAdministerTask(req.user!.id, req.user!.role, id as string))) {
    res.status(403).json({ error: 'Access denied. You cannot administer this task if you are assigned to it.' });
    return;
  }

  try {
    const { error } = await supabaseAdmin
      .from('task_assignees')
      .delete()
      .eq('task_id', id)
      .eq('user_id', userId);

    if (error) { res.status(500).json({ error: error.message }); return; }

    // Re-fetch full task
    const { data: fullTask, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', id)
      .single();

    if (fetchError) { res.status(500).json({ error: fetchError.message }); return; }

    res.json({ task: fullTask });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove assignee' });
  }
});

// PUT /api/tasks/:id/assignees/:userId — Admin updates a specific assignee's data
router.put('/:id/assignees/:userId', authMiddleware, ownerOrTeamLeader, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id, userId } = req.params;
  const { status, feedback, rating } = req.body;

  if (!(await canAdministerTask(req.user!.id, req.user!.role, id as string))) {
    res.status(403).json({ error: 'Access denied. You cannot administer this task if you are assigned to it.' });
    return;
  }

  try {
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (feedback !== undefined) updates.feedback = feedback;
    if (rating !== undefined) {
      if (rating !== null && (typeof rating !== 'number' || rating < 1 || rating > 10)) {
        res.status(400).json({ error: 'Rating must be an integer between 1 and 10' });
        return;
      }
      updates.rating = rating;
    }
    updates.updated_at = new Date().toISOString();

    // Check if assignee has a running timer, stop it if we are updating their record/status
    const { data: assignment } = await supabaseAdmin
      .from('task_assignees')
      .select('*')
      .eq('task_id', id)
      .eq('user_id', userId)
      .single();

    if (assignment && assignment.timer_started_at) {
      const startTime = new Date(assignment.timer_started_at).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      updates.total_time_spent = (assignment.total_time_spent || 0) + elapsedSeconds;
      updates.timer_started_at = null;
    }

    const { error } = await supabaseAdmin
      .from('task_assignees')
      .update(updates)
      .eq('task_id', id)
      .eq('user_id', userId);

    if (error) { res.status(500).json({ error: error.message }); return; }

    // Re-fetch full task
    const { data: fullTask, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', id)
      .single();

    if (fetchError) { res.status(500).json({ error: fetchError.message }); return; }

    res.json({ task: fullTask });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update assignee' });
  }
});

// DELETE /api/tasks/:id — Delete task (owner or team leader)
router.delete('/:id', authMiddleware, ownerOrTeamLeader, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!(await canAdministerTask(req.user!.id, req.user!.role, id as string))) {
    res.status(403).json({ error: 'Access denied. You cannot administer this task if you are assigned to it.' });
    return;
  }

  try {
    const { error } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST /api/tasks/target — Set or update task target (owner only)
router.post('/target', authMiddleware, ownerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { user_id, target_tasks, month } = req.body;

  if (!user_id || target_tasks === undefined || !month) {
    res.status(400).json({ error: 'user_id, target_tasks, and month (YYYY-MM) are required' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('task_targets')
      .upsert(
        { user_id, target_tasks: Number(target_tasks), month },
        { onConflict: 'user_id,month' }
      )
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ target: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set target' });
  }
});

// GET /api/tasks/target/:userId/:month — Fetch target for a specific user and month (owner or self)
router.get('/target/:userId/:month', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { userId, month } = req.params;
  const userIdStr = userId as string;
  const monthStr = month as string;
  const callerId = req.user!.id;
  const callerRole = req.user!.role;

  if (callerRole !== 'owner' && callerId !== userIdStr) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('task_targets')
      .select('*')
      .eq('user_id', userIdStr)
      .eq('month', monthStr)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ target: data || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch target' });
  }
});

// GET /api/tasks/target/:userId/:month/progress — Fetch progress (owner or self)
router.get('/target/:userId/:month/progress', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { userId, month } = req.params;
  const userIdStr = userId as string;
  const monthStr = month as string;
  const callerId = req.user!.id;
  const callerRole = req.user!.role;

  if (callerRole !== 'owner' && callerId !== userIdStr) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  try {
    // 1. Fetch target tasks
    const { data: targetData, error: targetError } = await supabaseAdmin
      .from('task_targets')
      .select('target_tasks')
      .eq('user_id', userIdStr)
      .eq('month', monthStr)
      .maybeSingle();

    if (targetError) {
      res.status(500).json({ error: targetError.message });
      return;
    }

    const target = targetData ? targetData.target_tasks : 0;

    // 2. Fetch completed tasks count for that month using updated_at
    const [year, monthNum] = monthStr.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, monthNum, 1)).toISOString();

    // Count of completed tasks for this user in this date range
    const { count, error: countError } = await supabaseAdmin
      .from('task_assignees')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userIdStr)
      .eq('status', 'completed')
      .gte('updated_at', startDate)
      .lt('updated_at', endDate);

    if (countError) {
      res.status(500).json({ error: countError.message });
      return;
    }

    const completedTasks = count || 0;
    const progressPercent = target > 0 ? Math.round((completedTasks / target) * 100) : 0;

    res.json({
      target,
      completedTasks,
      progressPercent
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task target progress' });
  }
});

// POST /api/tasks/:id/timer/start — Start timer for an assignee
router.post('/:id/timer/start', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const callerId = req.user!.id;

  try {
    const { data: assignment, error: aErr } = await supabaseAdmin
      .from('task_assignees')
      .select('*')
      .eq('task_id', id)
      .eq('user_id', callerId)
      .single();

    if (aErr || !assignment) {
      res.status(403).json({ error: 'Access denied. You are not assigned to this task.' });
      return;
    }

    if (assignment.status !== 'in_progress') {
      res.status(400).json({ error: 'You must start the task before you can start the timer.' });
      return;
    }

    if (assignment.timer_started_at) {
      const { data: fullTask, error: fetchError } = await supabaseAdmin
        .from('tasks')
        .select(TASK_SELECT)
        .eq('id', id)
        .single();
      if (fetchError) { res.status(500).json({ error: fetchError.message }); return; }
      res.json({ task: fullTask });
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from('task_assignees')
      .update({
        timer_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', assignment.id);

    if (updateError) { res.status(500).json({ error: updateError.message }); return; }

    const { data: fullTask, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', id)
      .single();

    if (fetchError) { res.status(500).json({ error: fetchError.message }); return; }
    res.json({ task: fullTask });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// POST /api/tasks/:id/timer/stop — Stop/Pause timer for an assignee
router.post('/:id/timer/stop', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const callerId = req.user!.id;

  try {
    const { data: assignment, error: aErr } = await supabaseAdmin
      .from('task_assignees')
      .select('*')
      .eq('task_id', id)
      .eq('user_id', callerId)
      .single();

    if (aErr || !assignment) {
      res.status(403).json({ error: 'Access denied. You are not assigned to this task.' });
      return;
    }

    if (!assignment.timer_started_at) {
      const { data: fullTask, error: fetchError } = await supabaseAdmin
        .from('tasks')
        .select(TASK_SELECT)
        .eq('id', id)
        .single();
      if (fetchError) { res.status(500).json({ error: fetchError.message }); return; }
      res.json({ task: fullTask });
      return;
    }

    const startTime = new Date(assignment.timer_started_at).getTime();
    const nowTime = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((nowTime - startTime) / 1000));
    const newTotalTime = (assignment.total_time_spent || 0) + elapsedSeconds;

    const { error: updateError } = await supabaseAdmin
      .from('task_assignees')
      .update({
        timer_started_at: null,
        total_time_spent: newTotalTime,
        updated_at: new Date().toISOString()
      })
      .eq('id', assignment.id);

    if (updateError) { res.status(500).json({ error: updateError.message }); return; }

    const { data: fullTask, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', id)
      .single();

    if (fetchError) { res.status(500).json({ error: fetchError.message }); return; }
    res.json({ task: fullTask });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

export default router;

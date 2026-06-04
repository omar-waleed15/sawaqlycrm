import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOnly, ownerOrTeamLeader } from '../middleware/roleCheck';

const router = Router();

// GET /api/tasks — Get tasks (owner: all, member: assigned only)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, priority, assignee_id } = req.query;

    let query = supabaseAdmin
      .from('tasks')
      .select(`
        *,
        creator:profiles!tasks_creator_id_fkey(id, name, email, avatar_url),
        assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .order('created_at', { ascending: false });

    // Members only see their assigned tasks (team leaders and owners see all)
    if (req.user!.role !== 'owner' && req.user!.role !== 'team_leader') {
      query = query.eq('assignee_id', req.user!.id);
    } else if (assignee_id) {
      query = query.eq('assignee_id', assignee_id as string);
    }

    if (status) query = query.eq('status', status as string);
    if (priority) query = query.eq('priority', priority as string);

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ tasks: data });
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
      .select(`
        *,
        creator:profiles!tasks_creator_id_fkey(id, name, email, avatar_url),
        assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .eq('due_date', today)
      .order('created_at', { ascending: false });

    if (req.user!.role !== 'owner' && req.user!.role !== 'team_leader') {
      query = query.eq('assignee_id', req.user!.id);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ tasks: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily tasks' });
  }
});

// GET /api/tasks/stats — Dashboard stats (owner)
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let baseQuery = supabaseAdmin.from('tasks').select('status, due_date, assignee_id');

    if (req.user!.role !== 'owner' && req.user!.role !== 'team_leader') {
      baseQuery = baseQuery.eq('assignee_id', req.user!.id);
    }

    const { data: tasks, error } = await baseQuery;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const total = tasks?.length || 0;
    const completed = tasks?.filter(t => t.status === 'completed').length || 0;
    const inProgress = tasks?.filter(t => t.status === 'in_progress').length || 0;
    const submitted = tasks?.filter(t => t.status === 'submitted').length || 0;
    const todo = tasks?.filter(t => t.status === 'todo').length || 0;
    const overdue = tasks?.filter(t =>
      t.due_date && t.due_date < today && !['completed'].includes(t.status)
    ).length || 0;

    res.json({ stats: { total, completed, inProgress, submitted, todo, overdue } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/tasks — Create a new task (owner or team leader)
router.post('/', authMiddleware, ownerOrTeamLeader, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, description, priority, due_date, assignee_id, drive_link, content_type, content_description, publish_date } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        title,
        description: description || null,
        priority: priority || 'medium',
        status: 'todo',
        due_date: due_date || null,
        assignee_id: assignee_id || null,
        creator_id: req.user!.id,
        drive_link: drive_link || null,
        content_type: content_type || null,
        content_description: content_description || null,
        publish_date: publish_date || null,
      })
      .select(`
        *,
        creator:profiles!tasks_creator_id_fkey(id, name, email, avatar_url),
        assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ task: data });
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
        assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url),
        attachments(*),
        comments(*, user:profiles(id, name, email, avatar_url))
      `)
      .eq('id', id)
      .single();

    if (error) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Members can only view their assigned tasks (team leaders and owners can view all)
    if (!['owner', 'team_leader'].includes(req.user!.role) && data.assignee_id !== req.user!.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ task: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// PUT /api/tasks/:id — Update task
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const isTaskAdmin = ['owner', 'team_leader'].includes(req.user!.role);

  try {
    // Verify task exists and member has access
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (!isTaskAdmin && existing.assignee_id !== req.user!.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    let updates: Record<string, unknown> = {};

    if (isTaskAdmin) {
      // Admin/TL can update everything
      const { title, description, priority, status, due_date, assignee_id, feedback, drive_link, content_type, content_description, publish_date, publish_notes } = req.body;
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (priority !== undefined) updates.priority = priority;
      if (status !== undefined) updates.status = status;
      if (due_date !== undefined) updates.due_date = due_date;
      if (assignee_id !== undefined) updates.assignee_id = assignee_id;
      if (feedback !== undefined) updates.feedback = feedback;
      if (drive_link !== undefined) updates.drive_link = drive_link;
      if (content_type !== undefined) updates.content_type = content_type;
      if (content_description !== undefined) updates.content_description = content_description;
      if (publish_date !== undefined) updates.publish_date = publish_date;
      if (publish_notes !== undefined) updates.publish_notes = publish_notes;
    } else {
      // Members can update status, submission_link, progress_note, and publish_date
      const { status, submission_link, progress_note, publish_date, publish_notes } = req.body;
      const allowedStatuses = ['todo', 'in_progress', 'submitted'];
      if (status && allowedStatuses.includes(status)) updates.status = status;
      if (submission_link !== undefined) updates.submission_link = submission_link;
      if (progress_note !== undefined) updates.progress_note = progress_note;
      if (publish_date !== undefined) updates.publish_date = publish_date;
      if (publish_notes !== undefined) updates.publish_notes = publish_notes;
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        creator:profiles!tasks_creator_id_fkey(id, name, email, avatar_url),
        assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ task: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id — Delete task (owner or team leader)
router.delete('/:id', authMiddleware, ownerOrTeamLeader, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

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

export default router;

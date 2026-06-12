"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const roleCheck_1 = require("../middleware/roleCheck");
const router = (0, express_1.Router)();
// Helper: build task select query with assignees joined
const TASK_SELECT = `
  *,
  creator:profiles!tasks_creator_id_fkey(id, name, email, avatar_url),
  task_assignees(
    id,
    user_id,
    status,
    submission_link,
    completion_note,
    feedback,
    assigned_at,
    updated_at,
    user:profiles(id, name, email, avatar_url)
  )
`;
// Helper: check if user is admin/TL
function isTaskAdmin(role) {
    return role === 'owner' || role === 'team_leader' || role === 'moderation' || role === 'account_manager';
}
// GET /api/tasks — Get tasks (owner: all, member: assigned only)
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const { status, priority, assignee_id } = req.query;
        const userRole = req.user.role;
        if (isTaskAdmin(userRole)) {
            // Admin/TL: see all tasks (optionally filter by assignee)
            let query = supabase_1.supabaseAdmin
                .from('tasks')
                .select(TASK_SELECT)
                .order('created_at', { ascending: false });
            if (priority)
                query = query.eq('priority', priority);
            const { data, error } = await query;
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            let tasks = data || [];
            // Filter by assignee_id if provided (check task_assignees array)
            if (assignee_id) {
                tasks = tasks.filter((t) => t.task_assignees?.some((a) => a.user_id === assignee_id));
            }
            // Filter by status if provided (check if any assignee matches)
            if (status) {
                tasks = tasks.filter((t) => t.task_assignees?.some((a) => a.status === status));
            }
            res.json({ tasks });
        }
        else {
            // Member/Sales: see tasks they're assigned to OR tasks they created
            const { data: assignments, error: aErr } = await supabase_1.supabaseAdmin
                .from('task_assignees')
                .select('task_id')
                .eq('user_id', req.user.id);
            if (aErr) {
                res.status(500).json({ error: aErr.message });
                return;
            }
            const taskIds = (assignments || []).map((a) => a.task_id);
            let query = supabase_1.supabaseAdmin
                .from('tasks')
                .select(TASK_SELECT)
                .order('created_at', { ascending: false });
            if (priority)
                query = query.eq('priority', priority);
            if (taskIds.length > 0) {
                query = query.or(`creator_id.eq.${req.user.id},id.in.(${taskIds.join(',')})`);
            }
            else {
                query = query.eq('creator_id', req.user.id);
            }
            const { data, error } = await query;
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            let tasks = data || [];
            // Filter by status (only the member's own assignment status OR if creator, checking if any assignee matches status)
            if (status) {
                tasks = tasks.filter((t) => t.task_assignees?.some((a) => (a.user_id === req.user.id && a.status === status) ||
                    (t.creator_id === req.user.id && a.status === status)));
            }
            res.json({ tasks });
        }
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});
// GET /api/tasks/daily — Tasks due today
router.get('/daily', auth_1.authMiddleware, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        let query = supabase_1.supabaseAdmin
            .from('tasks')
            .select(TASK_SELECT)
            .eq('due_date', today)
            .order('created_at', { ascending: false });
        const { data, error } = await query;
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        let tasks = data || [];
        // Members: filter to only their assigned tasks
        if (!isTaskAdmin(req.user.role)) {
            tasks = tasks.filter((t) => t.task_assignees?.some((a) => a.user_id === req.user.id));
        }
        res.json({ tasks });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch daily tasks' });
    }
});
// GET /api/tasks/stats — Dashboard stats
router.get('/stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const isAdmin = isTaskAdmin(req.user.role);
        // Fetch task_assignees with task due_date
        let query = supabase_1.supabaseAdmin
            .from('task_assignees')
            .select('status, task:tasks(due_date)');
        if (!isAdmin) {
            query = query.eq('user_id', req.user.id);
        }
        const { data: assignments, error } = await query;
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        const items = assignments || [];
        const total = items.length;
        const completed = items.filter((a) => a.status === 'completed').length;
        const inProgress = items.filter((a) => a.status === 'in_progress').length;
        const submitted = items.filter((a) => a.status === 'submitted').length;
        const todo = items.filter((a) => a.status === 'todo').length;
        const overdue = items.filter((a) => {
            const dueDate = a.task?.due_date;
            return dueDate && dueDate < today && a.status !== 'completed';
        }).length;
        res.json({ stats: { total, completed, inProgress, submitted, todo, overdue } });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
// POST /api/tasks — Create a new task (owner, team leader or sales)
router.post('/', auth_1.authMiddleware, roleCheck_1.ownerOrTeamLeaderOrSales, async (req, res) => {
    const { title, description, priority, due_date, assignee_ids, drive_link, content_type, content_description, publish_date, client_id, project_id } = req.body;
    if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
    }
    try {
        // Create the task (shared fields only)
        const { data: task, error: taskError } = await supabase_1.supabaseAdmin
            .from('tasks')
            .insert({
            title,
            description: description || null,
            priority: priority || 'medium',
            status: 'todo', // kept for backward compat, not used by app
            due_date: due_date || null,
            assignee_id: null, // deprecated
            creator_id: req.user.id,
            drive_link: drive_link || null,
            content_type: content_type || null,
            content_description: content_description || null,
            publish_date: publish_date || null,
            client_id: client_id || null,
            project_id: project_id || null,
        })
            .select('*')
            .single();
        if (taskError) {
            res.status(500).json({ error: taskError.message });
            return;
        }
        // Insert assignees
        const ids = Array.isArray(assignee_ids) ? assignee_ids : (assignee_ids ? [assignee_ids] : []);
        if (ids.length > 0) {
            const rows = ids.map((uid) => ({
                task_id: task.id,
                user_id: uid,
                status: 'todo',
            }));
            const { error: assignError } = await supabase_1.supabaseAdmin
                .from('task_assignees')
                .insert(rows);
            if (assignError) {
                console.error('Failed to insert assignees:', assignError.message);
            }
        }
        // Re-fetch full task with assignees
        const { data: fullTask, error: fetchError } = await supabase_1.supabaseAdmin
            .from('tasks')
            .select(TASK_SELECT)
            .eq('id', task.id)
            .single();
        if (fetchError) {
            res.status(500).json({ error: fetchError.message });
            return;
        }
        res.status(201).json({ task: fullTask });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create task' });
    }
});
// GET /api/tasks/:id — Get task detail
router.get('/:id', auth_1.authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('tasks')
            .select(`
        ${TASK_SELECT},
        attachments(*),
        comments(*, user:profiles(id, name, email, avatar_url))
      `)
            .eq('id', id)
            .single();
        if (error) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        // Non-admins can only view tasks they are assigned to OR tasks they created
        if (!isTaskAdmin(req.user.role)) {
            const isAssigned = data.task_assignees?.some((a) => a.user_id === req.user.id);
            const isCreator = data.creator_id === req.user.id;
            if (!isAssigned && !isCreator) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
        }
        // Filter out comments older than 24 hours (fallback cleanup)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        if (data.comments) {
            const expiredIds = data.comments
                .filter((c) => c.created_at < twentyFourHoursAgo)
                .map((c) => c.id);
            // Delete expired comments in background
            if (expiredIds.length > 0) {
                supabase_1.supabaseAdmin
                    .from('comments')
                    .delete()
                    .in('id', expiredIds)
                    .then(() => { });
            }
            // Only return non-expired comments
            data.comments = data.comments.filter((c) => c.created_at >= twentyFourHoursAgo);
        }
        res.json({ task: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});
// PUT /api/tasks/:id — Update task (shared fields for admin, own assignment for members)
router.put('/:id', auth_1.authMiddleware, async (req, res) => {
    const { id } = req.params;
    const admin = isTaskAdmin(req.user.role);
    try {
        // Verify task exists
        const { data: existing, error: fetchError } = await supabase_1.supabaseAdmin
            .from('tasks')
            .select('id, creator_id')
            .eq('id', id)
            .single();
        if (fetchError || !existing) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        const isCreator = existing.creator_id === req.user.id;
        const canManage = admin || isCreator;
        if (canManage) {
            // Admin: update shared task fields
            const { title, description, priority, due_date, drive_link, content_type, content_description, publish_date, publish_notes, assignee_ids, client_id, project_id } = req.body;
            const updates = {};
            if (title !== undefined)
                updates.title = title;
            if (description !== undefined)
                updates.description = description;
            if (priority !== undefined)
                updates.priority = priority;
            if (due_date !== undefined)
                updates.due_date = due_date;
            if (drive_link !== undefined)
                updates.drive_link = drive_link;
            if (content_type !== undefined)
                updates.content_type = content_type;
            if (content_description !== undefined)
                updates.content_description = content_description;
            if (publish_date !== undefined)
                updates.publish_date = publish_date;
            if (publish_notes !== undefined)
                updates.publish_notes = publish_notes;
            if (client_id !== undefined)
                updates.client_id = client_id || null;
            if (project_id !== undefined)
                updates.project_id = project_id || null;
            updates.updated_at = new Date().toISOString();
            const { error: updateError } = await supabase_1.supabaseAdmin
                .from('tasks')
                .update(updates)
                .eq('id', id);
            if (updateError) {
                res.status(500).json({ error: updateError.message });
                return;
            }
            // If assignee_ids provided, sync assignees
            if (assignee_ids !== undefined) {
                const newIds = Array.isArray(assignee_ids) ? assignee_ids : [];
                // Get current assignees
                const { data: currentAssignees } = await supabase_1.supabaseAdmin
                    .from('task_assignees')
                    .select('user_id')
                    .eq('task_id', id);
                const currentIds = (currentAssignees || []).map((a) => a.user_id);
                const toAdd = newIds.filter(uid => !currentIds.includes(uid));
                const toRemove = currentIds.filter((uid) => !newIds.includes(uid));
                if (toRemove.length > 0) {
                    await supabase_1.supabaseAdmin
                        .from('task_assignees')
                        .delete()
                        .eq('task_id', id)
                        .in('user_id', toRemove);
                }
                if (toAdd.length > 0) {
                    const rows = toAdd.map(uid => ({ task_id: id, user_id: uid, status: 'todo' }));
                    await supabase_1.supabaseAdmin.from('task_assignees').insert(rows);
                }
            }
        }
        else {
            // Member: check they're assigned
            const { data: assignment, error: aErr } = await supabase_1.supabaseAdmin
                .from('task_assignees')
                .select('id')
                .eq('task_id', id)
                .eq('user_id', req.user.id)
                .single();
            if (aErr || !assignment) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            // Member can update their own assignment
            const { status, submission_link, completion_note } = req.body;
            const assignUpdates = {};
            const allowedStatuses = ['todo', 'in_progress', 'submitted'];
            if (status && allowedStatuses.includes(status))
                assignUpdates.status = status;
            if (submission_link !== undefined)
                assignUpdates.submission_link = submission_link;
            if (completion_note !== undefined)
                assignUpdates.completion_note = completion_note;
            assignUpdates.updated_at = new Date().toISOString();
            const { error: updateError } = await supabase_1.supabaseAdmin
                .from('task_assignees')
                .update(assignUpdates)
                .eq('id', assignment.id);
            if (updateError) {
                res.status(500).json({ error: updateError.message });
                return;
            }
        }
        // Re-fetch full task
        const { data: fullTask, error: reFetchError } = await supabase_1.supabaseAdmin
            .from('tasks')
            .select(TASK_SELECT)
            .eq('id', id)
            .single();
        if (reFetchError) {
            res.status(500).json({ error: reFetchError.message });
            return;
        }
        res.json({ task: fullTask });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update task' });
    }
});
// POST /api/tasks/:id/assignees — Add an assignee to a task (admin or creator)
router.post('/:id/assignees', auth_1.authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    if (!user_id) {
        res.status(400).json({ error: 'user_id is required' });
        return;
    }
    try {
        const admin = isTaskAdmin(req.user.role);
        const { data: existing, error: fetchError } = await supabase_1.supabaseAdmin
            .from('tasks')
            .select('creator_id')
            .eq('id', id)
            .single();
        if (fetchError || !existing) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        const isCreator = existing.creator_id === req.user.id;
        if (!admin && !isCreator) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const { error } = await supabase_1.supabaseAdmin
            .from('task_assignees')
            .insert({ task_id: id, user_id, status: 'todo' });
        if (error) {
            if (error.code === '23505') {
                res.status(409).json({ error: 'User is already assigned to this task' });
            }
            else {
                res.status(500).json({ error: error.message });
            }
            return;
        }
        // Re-fetch full task
        const { data: fullTask, error: fetchTaskError } = await supabase_1.supabaseAdmin
            .from('tasks')
            .select(TASK_SELECT)
            .eq('id', id)
            .single();
        if (fetchTaskError) {
            res.status(500).json({ error: fetchTaskError.message });
            return;
        }
        res.status(201).json({ task: fullTask });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to add assignee' });
    }
});
// DELETE /api/tasks/:id/assignees/:userId — Remove an assignee (admin or creator)
router.delete('/:id/assignees/:userId', auth_1.authMiddleware, async (req, res) => {
    const { id, userId } = req.params;
    try {
        const admin = isTaskAdmin(req.user.role);
        const { data: existing, error: fetchError } = await supabase_1.supabaseAdmin
            .from('tasks')
            .select('creator_id')
            .eq('id', id)
            .single();
        if (fetchError || !existing) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        const isCreator = existing.creator_id === req.user.id;
        if (!admin && !isCreator) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const { error } = await supabase_1.supabaseAdmin
            .from('task_assignees')
            .delete()
            .eq('task_id', id)
            .eq('user_id', userId);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        // Re-fetch full task
        const { data: fullTask, error: fetchTaskError } = await supabase_1.supabaseAdmin
            .from('tasks')
            .select(TASK_SELECT)
            .eq('id', id)
            .single();
        if (fetchTaskError) {
            res.status(500).json({ error: fetchTaskError.message });
            return;
        }
        res.json({ task: fullTask });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to remove assignee' });
    }
});
// PUT /api/tasks/:id/assignees/:userId — Admin/Creator updates a specific assignee's data
router.put('/:id/assignees/:userId', auth_1.authMiddleware, async (req, res) => {
    const { id, userId } = req.params;
    const { status, feedback } = req.body;
    try {
        const admin = isTaskAdmin(req.user.role);
        const { data: existing, error: fetchError } = await supabase_1.supabaseAdmin
            .from('tasks')
            .select('creator_id')
            .eq('id', id)
            .single();
        if (fetchError || !existing) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        const isCreator = existing.creator_id === req.user.id;
        if (!admin && !isCreator) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const updates = {};
        if (status !== undefined)
            updates.status = status;
        if (feedback !== undefined)
            updates.feedback = feedback;
        updates.updated_at = new Date().toISOString();
        const { error } = await supabase_1.supabaseAdmin
            .from('task_assignees')
            .update(updates)
            .eq('task_id', id)
            .eq('user_id', userId);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        // Re-fetch full task
        const { data: fullTask, error: fetchTaskError } = await supabase_1.supabaseAdmin
            .from('tasks')
            .select(TASK_SELECT)
            .eq('id', id)
            .single();
        if (fetchTaskError) {
            res.status(500).json({ error: fetchTaskError.message });
            return;
        }
        res.json({ task: fullTask });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update assignee' });
    }
});
// DELETE /api/tasks/:id — Delete task (admin or creator)
router.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    const { id } = req.params;
    const admin = isTaskAdmin(req.user.role);
    try {
        // Check if task exists and get creator_id
        const { data: existing, error: fetchError } = await supabase_1.supabaseAdmin
            .from('tasks')
            .select('creator_id')
            .eq('id', id)
            .single();
        if (fetchError || !existing) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        const isCreator = existing.creator_id === req.user.id;
        if (!admin && !isCreator) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const { error } = await supabase_1.supabaseAdmin
            .from('tasks')
            .delete()
            .eq('id', id);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'Task deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete task' });
    }
});
exports.default = router;

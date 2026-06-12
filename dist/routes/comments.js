"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)({ mergeParams: true });
// GET /api/tasks/:taskId/comments
router.get('/', auth_1.authMiddleware, async (req, res) => {
    const { taskId } = req.params;
    try {
        // Verify user has access to this task
        const userRole = req.user.role;
        const isTaskAdmin = ['owner', 'team_leader', 'moderation', 'account_manager'].includes(userRole);
        if (!isTaskAdmin) {
            // Check if creator of the task
            const { data: task, error: taskError } = await supabase_1.supabaseAdmin
                .from('tasks')
                .select('creator_id')
                .eq('id', taskId)
                .single();
            const isCreator = !taskError && task && task.creator_id === req.user.id;
            if (!isCreator) {
                // Check if assigned to the task
                const { data: assignee, error: assigneeError } = await supabase_1.supabaseAdmin
                    .from('task_assignees')
                    .select('id')
                    .eq('task_id', taskId)
                    .eq('user_id', req.user.id)
                    .maybeSingle();
                if (assigneeError || !assignee) {
                    res.status(403).json({ error: 'Access denied. You do not have access to this task\'s comments.' });
                    return;
                }
            }
        }
        const { data, error } = await supabase_1.supabaseAdmin
            .from('comments')
            .select('*, user:profiles(id, name, email, avatar_url)')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true });
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ comments: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});
// POST /api/tasks/:taskId/comments
router.post('/', auth_1.authMiddleware, async (req, res) => {
    const { taskId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) {
        res.status(400).json({ error: 'Comment content is required' });
        return;
    }
    try {
        // Verify user has access to this task
        const userRole = req.user.role;
        const isTaskAdmin = ['owner', 'team_leader', 'moderation', 'account_manager'].includes(userRole);
        if (!isTaskAdmin) {
            // Check if creator of the task
            const { data: task, error: taskError } = await supabase_1.supabaseAdmin
                .from('tasks')
                .select('creator_id')
                .eq('id', taskId)
                .single();
            const isCreator = !taskError && task && task.creator_id === req.user.id;
            if (!isCreator) {
                // Check if assigned to the task
                const { data: assignee, error: assigneeError } = await supabase_1.supabaseAdmin
                    .from('task_assignees')
                    .select('id')
                    .eq('task_id', taskId)
                    .eq('user_id', req.user.id)
                    .maybeSingle();
                if (assigneeError || !assignee) {
                    res.status(403).json({ error: 'Access denied. You do not have access to this task\'s comments.' });
                    return;
                }
            }
        }
        const { data, error } = await supabase_1.supabaseAdmin
            .from('comments')
            .insert({
            task_id: taskId,
            user_id: req.user.id,
            content: content.trim(),
        })
            .select('*, user:profiles(id, name, email, avatar_url)')
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.status(201).json({ comment: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to post comment' });
    }
});
exports.default = router;

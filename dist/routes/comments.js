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
        // Verify member has access to this task
        if (req.user.role !== 'owner' && req.user.role !== 'team_leader') {
            const { data: task } = await supabase_1.supabaseAdmin
                .from('tasks')
                .select('assignee_id')
                .eq('id', taskId)
                .single();
            if (!task || task.assignee_id !== req.user.id) {
                res.status(403).json({ error: 'Access denied' });
                return;
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

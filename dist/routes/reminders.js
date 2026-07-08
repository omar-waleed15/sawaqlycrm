"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/reminders — List all reminders related to the current user (sent or received)
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { data, error } = await supabase_1.supabaseAdmin
            .from('reminders')
            .select(`
        *,
        sender:profiles!sender_id(name, avatar_url),
        receiver:profiles!receiver_id(name, avatar_url)
      `)
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order('created_at', { ascending: false });
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ reminders: data || [] });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch reminders' });
    }
});
// POST /api/reminders — Create new reminders (supports single receiver_id or receiver_ids array)
router.post('/', auth_1.authMiddleware, async (req, res) => {
    const { receiver_id, receiver_ids, content } = req.body;
    const senderId = req.user?.id;
    if (!senderId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const idsToInsert = [];
    if (Array.isArray(receiver_ids)) {
        idsToInsert.push(...receiver_ids);
    }
    else if (receiver_id) {
        idsToInsert.push(receiver_id);
    }
    if (idsToInsert.length === 0 || !content?.trim()) {
        res.status(400).json({ error: 'Recipient(s) and content are required' });
        return;
    }
    try {
        const rows = idsToInsert.map(rId => ({
            sender_id: senderId,
            receiver_id: rId,
            content: content.trim(),
        }));
        const { data, error } = await supabase_1.supabaseAdmin
            .from('reminders')
            .insert(rows)
            .select(`
        *,
        sender:profiles!sender_id(name, avatar_url),
        receiver:profiles!receiver_id(name, avatar_url)
      `);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.status(201).json({ reminders: data || [] });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create reminders' });
    }
});
// PUT /api/reminders/:id/read — Mark reminder as read (receiver only)
router.put('/:id/read', auth_1.authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('reminders')
            .update({ read_at: new Date().toISOString() })
            .eq('id', id)
            .eq('receiver_id', userId) // Security: only receiver can update read status
            .select(`
        *,
        sender:profiles!sender_id(name, avatar_url),
        receiver:profiles!receiver_id(name, avatar_url)
      `)
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ reminder: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update reminder' });
    }
});
// PUT /api/reminders/:id/done — Mark reminder as completed (receiver only)
router.put('/:id/done', auth_1.authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('reminders')
            .update({ completed_at: new Date().toISOString() })
            .eq('id', id)
            .eq('receiver_id', userId) // Security: only receiver can update completed status
            .select(`
        *,
        sender:profiles!sender_id(name, avatar_url),
        receiver:profiles!receiver_id(name, avatar_url)
      `)
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ reminder: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update reminder' });
    }
});
// DELETE /api/reminders/:id — Delete/retract a reminder (sender only)
router.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('reminders')
            .delete()
            .eq('id', id)
            .eq('sender_id', userId); // Security: only sender can delete
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'Reminder deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete reminder' });
    }
});
exports.default = router;

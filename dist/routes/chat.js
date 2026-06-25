"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/chat
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        // 1. Automatically delete messages older than 24 hours
        const { error: deleteError } = await supabase_1.supabaseAdmin
            .from('global_messages')
            .delete()
            .lt('created_at', yesterday);
        if (deleteError) {
            console.error('Error auto-deleting expired messages:', deleteError);
        }
        // 2. Fetch all remaining messages
        const { data, error } = await supabase_1.supabaseAdmin
            .from('global_messages')
            .select('*, user:profiles(id, name, email, avatar_url, role)')
            .order('created_at', { ascending: true });
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ messages: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch global chat messages' });
    }
});
// POST /api/chat
router.post('/', auth_1.authMiddleware, async (req, res) => {
    const { content } = req.body;
    if (!content || !content.trim()) {
        res.status(400).json({ error: 'Message content is required' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('global_messages')
            .insert({
            user_id: req.user.id,
            content: content.trim(),
        })
            .select('*, user:profiles(id, name, email, avatar_url, role)')
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.status(201).json({ message: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to send global chat message' });
    }
});
exports.default = router;

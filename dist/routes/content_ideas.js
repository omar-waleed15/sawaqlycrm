"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const roleCheck_1 = require("../middleware/roleCheck");
const router = (0, express_1.Router)();
// GET /api/ideas — List all content ideas (owner only)
router.get('/', auth_1.authMiddleware, roleCheck_1.ownerOrTeamLeader, async (_req, res) => {
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('content_ideas')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ ideas: data });
    }
    catch {
        res.status(500).json({ error: 'Failed to fetch content ideas' });
    }
});
// POST /api/ideas — Create a new content idea (owner only)
router.post('/', auth_1.authMiddleware, roleCheck_1.ownerOrTeamLeader, async (req, res) => {
    const { title, description, content_type, drive_link, content_description, rating } = req.body;
    if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
    }
    const validRatings = ['good', 'medium', 'bad'];
    if (rating && !validRatings.includes(rating)) {
        res.status(400).json({ error: 'Rating must be good, medium, or bad' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('content_ideas')
            .insert({
            title,
            description: description || null,
            content_type: content_type || null,
            drive_link: drive_link || null,
            content_description: content_description || null,
            rating: rating || 'medium',
            creator_id: req.user.id,
        })
            .select('*')
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.status(201).json({ idea: data });
    }
    catch {
        res.status(500).json({ error: 'Failed to create content idea' });
    }
});
// PUT /api/ideas/:id — Update a content idea (owner only)
router.put('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrTeamLeader, async (req, res) => {
    const { id } = req.params;
    const { title, description, content_type, drive_link, content_description, rating } = req.body;
    const validRatings = ['good', 'medium', 'bad'];
    if (rating && !validRatings.includes(rating)) {
        res.status(400).json({ error: 'Rating must be good, medium, or bad' });
        return;
    }
    try {
        const updates = { updated_at: new Date().toISOString() };
        if (title !== undefined)
            updates.title = title;
        if (description !== undefined)
            updates.description = description;
        if (content_type !== undefined)
            updates.content_type = content_type;
        if (drive_link !== undefined)
            updates.drive_link = drive_link;
        if (content_description !== undefined)
            updates.content_description = content_description;
        if (rating !== undefined)
            updates.rating = rating;
        const { data, error } = await supabase_1.supabaseAdmin
            .from('content_ideas')
            .update(updates)
            .eq('id', id)
            .select('*')
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ idea: data });
    }
    catch {
        res.status(500).json({ error: 'Failed to update content idea' });
    }
});
// DELETE /api/ideas/:id — Delete a content idea (owner only)
router.delete('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrTeamLeader, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('content_ideas')
            .delete()
            .eq('id', id);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'Content idea deleted successfully' });
    }
    catch {
        res.status(500).json({ error: 'Failed to delete content idea' });
    }
});
exports.default = router;

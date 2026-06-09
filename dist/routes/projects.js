"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const roleCheck_1 = require("../middleware/roleCheck");
const router = (0, express_1.Router)();
// GET /api/projects — List all projects (with client details)
router.get('/', auth_1.authMiddleware, roleCheck_1.ownerOrSalesOrTeamLeaderOrAccountManager, async (_req, res) => {
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('projects')
            .select(`
        *,
        client:clients(id, name, company, email, phone, status)
      `)
            .order('created_at', { ascending: false });
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ projects: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});
// POST /api/projects — Create a new project
router.post('/', auth_1.authMiddleware, roleCheck_1.ownerOrSalesOrTeamLeaderOrAccountManager, async (req, res) => {
    const { client_id, name, description, status, budget, start_date, end_date } = req.body;
    if (!name || !client_id) {
        res.status(400).json({ error: 'Project name and Client are required' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('projects')
            .insert({
            client_id,
            name,
            description: description || null,
            status: status || 'active',
            budget: budget ? Number(budget) : 0,
            start_date: start_date || null,
            end_date: end_date || null,
        })
            .select()
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        // Refetch to include client relation
        const { data: projectWithClient, error: refetchError } = await supabase_1.supabaseAdmin
            .from('projects')
            .select(`
        *,
        client:clients(id, name, company, email, phone, status)
      `)
            .eq('id', data.id)
            .single();
        if (refetchError) {
            res.status(201).json({ project: data });
            return;
        }
        res.status(201).json({ project: projectWithClient });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create project' });
    }
});
// PUT /api/projects/:id — Update a project
router.put('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrSalesOrTeamLeaderOrAccountManager, async (req, res) => {
    const { id } = req.params;
    const { client_id, name, description, status, budget, start_date, end_date } = req.body;
    try {
        const updates = {};
        if (client_id !== undefined)
            updates.client_id = client_id;
        if (name !== undefined)
            updates.name = name;
        if (description !== undefined)
            updates.description = description;
        if (status !== undefined)
            updates.status = status;
        if (budget !== undefined)
            updates.budget = budget ? Number(budget) : 0;
        if (start_date !== undefined)
            updates.start_date = start_date || null;
        if (end_date !== undefined)
            updates.end_date = end_date || null;
        const { data, error } = await supabase_1.supabaseAdmin
            .from('projects')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        // Refetch to include client relation
        const { data: projectWithClient, error: refetchError } = await supabase_1.supabaseAdmin
            .from('projects')
            .select(`
        *,
        client:clients(id, name, company, email, phone, status)
      `)
            .eq('id', data.id)
            .single();
        if (refetchError) {
            res.json({ project: data });
            return;
        }
        res.json({ project: projectWithClient });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update project' });
    }
});
// DELETE /api/projects/:id — Delete a project
router.delete('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrSalesOrTeamLeaderOrAccountManager, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('projects')
            .delete()
            .eq('id', id);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'Project deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});
exports.default = router;

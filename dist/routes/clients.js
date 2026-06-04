"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const roleCheck_1 = require("../middleware/roleCheck");
const router = (0, express_1.Router)();
// GET /api/clients — List all clients
router.get('/', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (_req, res) => {
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ clients: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});
// POST /api/clients — Create a new client
router.post('/', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { name, company, email, phone, status, pipeline_stage } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Client name is required' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('clients')
            .insert({
            name,
            company: company || null,
            email: email || null,
            phone: phone || null,
            status: status || 'active',
            pipeline_stage: pipeline_stage || 'new_lead',
        })
            .select()
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.status(201).json({ client: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create client' });
    }
});
// PUT /api/clients/:id — Update a client
router.put('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { id } = req.params;
    const { name, company, email, phone, status, pipeline_stage } = req.body;
    try {
        const updates = {};
        if (name !== undefined)
            updates.name = name;
        if (company !== undefined)
            updates.company = company;
        if (email !== undefined)
            updates.email = email;
        if (phone !== undefined)
            updates.phone = phone;
        if (status !== undefined)
            updates.status = status;
        if (pipeline_stage !== undefined)
            updates.pipeline_stage = pipeline_stage;
        const { data, error } = await supabase_1.supabaseAdmin
            .from('clients')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ client: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update client' });
    }
});
// DELETE /api/clients/:id — Delete a client
router.delete('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('clients')
            .delete()
            .eq('id', id);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'Client deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete client' });
    }
});
exports.default = router;

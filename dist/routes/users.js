"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const roleCheck_1 = require("../middleware/roleCheck");
const router = (0, express_1.Router)();
// GET /api/users — List all team members (owner, team leader, sales)
router.get('/', auth_1.authMiddleware, async (req, res) => {
    if (!req.user || !['owner', 'team_leader', 'sales', 'moderation', 'account_manager'].includes(req.user.role)) {
        res.status(403).json({ error: 'Access denied.' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('profiles')
            .select('id, name, email, role, avatar_url, created_at')
            .order('created_at', { ascending: false });
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ users: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// POST /api/users — Create a new team member (owner only)
router.post('/', auth_1.authMiddleware, roleCheck_1.ownerOnly, async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
        res.status(400).json({ error: 'Name, email, and password are required' });
        return;
    }
    const validRoles = ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager'];
    const userRole = validRoles.includes(role) ? role : 'member';
    try {
        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });
        if (authError || !authData.user) {
            res.status(400).json({ error: authError?.message || 'Failed to create user' });
            return;
        }
        // Insert profile
        const { data: profile, error: profileError } = await supabase_1.supabaseAdmin
            .from('profiles')
            .insert({
            id: authData.user.id,
            name,
            email,
            role: userRole,
        })
            .select()
            .single();
        if (profileError) {
            // Rollback: delete auth user
            await supabase_1.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            res.status(500).json({ error: profileError.message });
            return;
        }
        res.status(201).json({ user: profile });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});
// PUT /api/users/:id — Update user (owner only)
router.put('/:id', auth_1.authMiddleware, roleCheck_1.ownerOnly, async (req, res) => {
    const { id } = req.params;
    const { name, role } = req.body;
    try {
        const updates = {};
        if (name)
            updates.name = name;
        if (role && ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager'].includes(role))
            updates.role = role;
        const { data, error } = await supabase_1.supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ user: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});
// DELETE /api/users/:id — Remove a team member (owner only)
router.delete('/:id', auth_1.authMiddleware, roleCheck_1.ownerOnly, async (req, res) => {
    const id = req.params.id;
    try {
        // Delete from Supabase Auth (cascades to profiles via DB trigger)
        const { error } = await supabase_1.supabaseAdmin.auth.admin.deleteUser(id);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'User deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
exports.default = router;

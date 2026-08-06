"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const ALL_SYSTEM_ROLES = [
    'team_leader',
    'sales',
    'member',
    'developer',
    'graphic_designer',
    'video_editor',
    'reel_maker',
    'moderation',
    'account_manager',
    'content_creator',
    'content_creator_intern',
];
// GET /api/roles — List role descriptions
// Owner sees all roles; other members see only their own role
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // Block clients
        if (user.role === 'client') {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        if (user.role === 'owner') {
            // Owner sees all role descriptions
            const { data, error } = await supabase_1.supabaseAdmin
                .from('role_descriptions')
                .select('*')
                .order('role_key');
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            let existing = data || [];
            const existingKeys = existing.map((r) => r.role_key);
            const missingKeys = ALL_SYSTEM_ROLES.filter(k => !existingKeys.includes(k));
            if (missingKeys.length > 0) {
                const rowsToInsert = missingKeys.map(k => ({ role_key: k }));
                const { data: insertedData } = await supabase_1.supabaseAdmin
                    .from('role_descriptions')
                    .insert(rowsToInsert)
                    .select();
                if (insertedData) {
                    existing = [...existing, ...insertedData];
                }
                else {
                    missingKeys.forEach(k => existing.push({ role_key: k }));
                }
            }
            res.json({ roles: existing });
        }
        else {
            // Non-owner sees only their own role
            let { data, error } = await supabase_1.supabaseAdmin
                .from('role_descriptions')
                .select('*')
                .eq('role_key', user.role)
                .single();
            if (!data) {
                data = { role_key: user.role };
            }
            res.json({ roles: [data] });
        }
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch role descriptions' });
    }
});
// PUT /api/roles/:roleKey — Update a role description (owner only)
router.put('/:roleKey', auth_1.authMiddleware, async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        if (user.role !== 'owner') {
            res.status(403).json({ error: 'Only the admin can edit role descriptions' });
            return;
        }
        const { roleKey } = req.params;
        const { description = '', general_roles = '', job_description = '', job_roles = '', non_negotiables = '', } = req.body;
        const updatePayload = {
            role_key: roleKey,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
        };
        if (description !== undefined)
            updatePayload.description = description;
        if (general_roles !== undefined)
            updatePayload.general_roles = general_roles;
        if (job_description !== undefined)
            updatePayload.job_description = job_description;
        if (job_roles !== undefined)
            updatePayload.job_roles = job_roles;
        if (non_negotiables !== undefined)
            updatePayload.non_negotiables = non_negotiables;
        const { data, error } = await supabase_1.supabaseAdmin
            .from('role_descriptions')
            .upsert(updatePayload, { onConflict: 'role_key' })
            .select()
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ role: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update role description' });
    }
});
exports.default = router;

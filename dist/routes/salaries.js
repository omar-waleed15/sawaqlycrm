"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const roleCheck_1 = require("../middleware/roleCheck");
const router = (0, express_1.Router)();
// GET /api/salaries — List all salary records (filter: ?month=YYYY-MM)
router.get('/', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    let { month } = req.query;
    try {
        if (!month || typeof month !== 'string') {
            const now = new Date();
            month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        const firstDayOfMonth = `${month}-01`;
        const { data, error } = await supabase_1.supabaseAdmin
            .from('salaries')
            .select(`
        *,
        user:profiles(id, name, email, role, avatar_url)
      `)
            .eq('month', firstDayOfMonth)
            .order('created_at', { ascending: false });
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ salaries: data || [] });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch salaries' });
    }
});
// POST /api/salaries — Create or upsert a salary record
router.post('/', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { user_id, amount, month, paid, note } = req.body;
    if (!user_id || amount === undefined || !month) {
        res.status(400).json({ error: 'User, amount, and month are required' });
        return;
    }
    // Normalize month to first day of month (e.g. YYYY-MM-01)
    const normalizedMonth = month.length === 7 ? `${month}-01` : month;
    try {
        // Check if salary record already exists for this user and month
        const { data: existing, error: checkError } = await supabase_1.supabaseAdmin
            .from('salaries')
            .select('id')
            .eq('user_id', user_id)
            .eq('month', normalizedMonth)
            .maybeSingle();
        if (checkError) {
            res.status(500).json({ error: checkError.message });
            return;
        }
        let result;
        if (existing) {
            // Update
            const { data, error } = await supabase_1.supabaseAdmin
                .from('salaries')
                .update({
                amount: Number(amount),
                paid: paid !== undefined ? Boolean(paid) : false,
                note: note || null,
            })
                .eq('id', existing.id)
                .select(`
          *,
          user:profiles(id, name, email, role, avatar_url)
        `)
                .single();
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            result = data;
        }
        else {
            // Insert new
            const { data, error } = await supabase_1.supabaseAdmin
                .from('salaries')
                .insert({
                user_id,
                amount: Number(amount),
                month: normalizedMonth,
                paid: paid !== undefined ? Boolean(paid) : false,
                note: note || null,
                created_by: req.user.id,
            })
                .select(`
          *,
          user:profiles(id, name, email, role, avatar_url)
        `)
                .single();
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            result = data;
        }
        res.status(existing ? 200 : 201).json({ salary: result });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to save salary record' });
    }
});
// PUT /api/salaries/:id — Update a salary record (paid toggle, amount, note)
router.put('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { id } = req.params;
    const { amount, paid, note } = req.body;
    try {
        const updates = {};
        if (amount !== undefined)
            updates.amount = Number(amount);
        if (paid !== undefined)
            updates.paid = Boolean(paid);
        if (note !== undefined)
            updates.note = note || null;
        const { data, error } = await supabase_1.supabaseAdmin
            .from('salaries')
            .update(updates)
            .eq('id', id)
            .select(`
        *,
        user:profiles(id, name, email, role, avatar_url)
      `)
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ salary: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update salary' });
    }
});
// DELETE /api/salaries/:id — Delete a salary record
router.delete('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('salaries')
            .delete()
            .eq('id', id);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'Salary record deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete salary record' });
    }
});
exports.default = router;

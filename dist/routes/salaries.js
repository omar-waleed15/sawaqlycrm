"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const roleCheck_1 = require("../middleware/roleCheck");
const router = (0, express_1.Router)();
const SALARY_SELECT = `
  *,
  user:profiles!salaries_user_id_fkey(id, name, email, role, avatar_url),
  installments:salary_installments(id, salary_id, amount, due_date, paid, note, created_at),
  penalties:salary_penalties(id, salary_id, amount, notes, created_at)
`;
// GET /api/salaries — List all salary records (filter: ?month=YYYY-MM)
router.get('/', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    let { month } = req.query;
    try {
        if (!month || typeof month !== 'string') {
            const now = new Date();
            month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        const firstDayOfMonth = `${month}-01`;
        console.log('[Salaries GET] Querying month:', firstDayOfMonth);
        const { data, error } = await supabase_1.supabaseAdmin
            .from('salaries')
            .select(SALARY_SELECT)
            .eq('month', firstDayOfMonth)
            .order('created_at', { ascending: false });
        console.log('[Salaries GET] Result count:', data?.length, '| Error:', error?.message);
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
    const { user_id, amount, month, paid, paid_date, is_recurring, recurrence, note, installments } = req.body;
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
        const salaryPayload = {
            amount: Number(amount),
            paid: paid !== undefined ? Boolean(paid) : false,
            paid_date: paid_date || null,
            is_recurring: is_recurring !== undefined ? Boolean(is_recurring) : true,
            recurrence: is_recurring ? (recurrence || 'monthly') : null,
            note: note || null,
        };
        let salaryId;
        if (existing) {
            const { data, error } = await supabase_1.supabaseAdmin
                .from('salaries')
                .update(salaryPayload)
                .eq('id', existing.id)
                .select('id')
                .single();
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            salaryId = existing.id;
        }
        else {
            const { data, error } = await supabase_1.supabaseAdmin
                .from('salaries')
                .insert({ user_id, month: normalizedMonth, created_by: req.user.id, ...salaryPayload })
                .select('id')
                .single();
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            salaryId = data.id;
        }
        // Handle installments for one-time salaries
        if (!is_recurring && Array.isArray(installments)) {
            // Delete old installments if updating
            if (existing) {
                await supabase_1.supabaseAdmin.from('salary_installments').delete().eq('salary_id', salaryId);
            }
            if (installments.length > 0) {
                const rows = installments.map((inst) => ({
                    salary_id: salaryId,
                    amount: Number(inst.amount),
                    due_date: inst.due_date || null,
                    paid: Boolean(inst.paid) || false,
                    note: inst.note || null,
                }));
                const { error: instError } = await supabase_1.supabaseAdmin.from('salary_installments').insert(rows);
                if (instError) {
                    res.status(500).json({ error: instError.message });
                    return;
                }
            }
        }
        // Fetch the full record with joins
        const { data: result, error: fetchError } = await supabase_1.supabaseAdmin
            .from('salaries')
            .select(SALARY_SELECT)
            .eq('id', salaryId)
            .single();
        if (fetchError) {
            res.status(500).json({ error: fetchError.message });
            return;
        }
        res.status(existing ? 200 : 201).json({ salary: result });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to save salary record' });
    }
});
// PUT /api/salaries/:id — Update a salary record
router.put('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { id } = req.params;
    const { amount, paid, paid_date, is_recurring, recurrence, note, installments } = req.body;
    try {
        const updates = {};
        if (amount !== undefined)
            updates.amount = Number(amount);
        if (paid !== undefined)
            updates.paid = Boolean(paid);
        if (paid_date !== undefined)
            updates.paid_date = paid_date || null;
        if (is_recurring !== undefined) {
            updates.is_recurring = Boolean(is_recurring);
            updates.recurrence = is_recurring ? (recurrence || 'monthly') : null;
        }
        if (note !== undefined)
            updates.note = note || null;
        const { error: updateError } = await supabase_1.supabaseAdmin
            .from('salaries')
            .update(updates)
            .eq('id', id);
        if (updateError) {
            res.status(500).json({ error: updateError.message });
            return;
        }
        // Handle installments
        if (is_recurring === false && Array.isArray(installments)) {
            await supabase_1.supabaseAdmin.from('salary_installments').delete().eq('salary_id', id);
            if (installments.length > 0) {
                const rows = installments.map((inst) => ({
                    salary_id: id,
                    amount: Number(inst.amount),
                    due_date: inst.due_date || null,
                    paid: Boolean(inst.paid) || false,
                    note: inst.note || null,
                }));
                const { error: instError } = await supabase_1.supabaseAdmin.from('salary_installments').insert(rows);
                if (instError) {
                    res.status(500).json({ error: instError.message });
                    return;
                }
            }
        }
        else if (is_recurring === true) {
            // Clear installments if switched back to recurring
            await supabase_1.supabaseAdmin.from('salary_installments').delete().eq('salary_id', id);
        }
        const { data, error: fetchError } = await supabase_1.supabaseAdmin
            .from('salaries')
            .select(SALARY_SELECT)
            .eq('id', id)
            .single();
        if (fetchError) {
            res.status(500).json({ error: fetchError.message });
            return;
        }
        res.json({ salary: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update salary' });
    }
});
// PATCH /api/salaries/:id/installments/:instId/paid — Toggle installment paid status
router.patch('/:id/installments/:instId/paid', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { instId } = req.params;
    const { paid } = req.body;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('salary_installments')
            .update({ paid: Boolean(paid) })
            .eq('id', instId);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'Updated' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update installment' });
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
// POST /api/salaries/:id/penalties — Add a penalty to a salary record (Owner only)
router.post('/:id/penalties', auth_1.authMiddleware, roleCheck_1.ownerOnly, async (req, res) => {
    const { id } = req.params;
    const { amount, notes } = req.body;
    if (amount === undefined || isNaN(Number(amount))) {
        res.status(400).json({ error: 'Amount is required and must be a number' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('salary_penalties')
            .insert({
            salary_id: id,
            amount: Number(amount),
            notes: notes || null
        })
            .select('*')
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.status(201).json({ penalty: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create penalty' });
    }
});
// DELETE /api/salaries/:id/penalties/:penaltyId — Delete a penalty (Owner only)
router.delete('/:id/penalties/:penaltyId', auth_1.authMiddleware, roleCheck_1.ownerOnly, async (req, res) => {
    const { penaltyId } = req.params;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('salary_penalties')
            .delete()
            .eq('id', penaltyId);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'Penalty deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete penalty' });
    }
});
exports.default = router;

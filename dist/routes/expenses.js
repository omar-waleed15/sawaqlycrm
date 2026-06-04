"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const roleCheck_1 = require("../middleware/roleCheck");
const router = (0, express_1.Router)();
// GET /api/expenses — List all expenses (with optional filters)
router.get('/', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { category, month } = req.query;
    console.log(`[GET /api/expenses] category=${category}, month=${month}`);
    try {
        let query = supabase_1.supabaseAdmin
            .from('expenses')
            .select('*')
            .order('date', { ascending: false });
        if (category) {
            query = query.eq('category', category);
        }
        if (month && typeof month === 'string' && month.includes('-')) {
            const start = `${month}-01`;
            const [yearStr, monthStr] = month.split('-');
            const year = parseInt(yearStr);
            const m = parseInt(monthStr);
            const nextMonth = m === 12 ? 1 : m + 1;
            const nextYear = m === 12 ? year + 1 : year;
            const nextMonthStr = nextMonth < 10 ? `0${nextMonth}` : nextMonth;
            const end = `${nextYear}-${nextMonthStr}-01`;
            console.log(`[GET /api/expenses] Filtering dates gte=${start} lt=${end}`);
            query = query.gte('date', start).lt('date', end);
        }
        const { data, error } = await query;
        if (error) {
            console.error(`[GET /api/expenses] Database error:`, error);
            res.status(500).json({ error: error.message });
            return;
        }
        console.log(`[GET /api/expenses] Found ${data?.length || 0} expenses`);
        res.json({ expenses: data || [] });
    }
    catch (err) {
        console.error(`[GET /api/expenses] Request failed:`, err);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});
// GET /api/expenses/stats — Dashboard stats for expenses & salaries
router.get('/stats', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const currentMonthStr = `${year}-${month.toString().padStart(2, '0')}`;
        const start = `${currentMonthStr}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonthStr = nextMonth < 10 ? `0${nextMonth}` : nextMonth;
        const end = `${nextYear}-${nextMonthStr}-01`;
        // 1. Get recurring contract revenue (MRR)
        const { data: activeContracts } = await supabase_1.supabaseAdmin
            .from('contracts')
            .select('amount, billing_cycle, is_recurring')
            .eq('status', 'active');
        let monthlyRevenue = 0;
        if (activeContracts) {
            activeContracts.forEach(c => {
                if (!c.is_recurring)
                    return;
                const amount = Number(c.amount) || 0;
                if (c.billing_cycle === 'monthly') {
                    monthlyRevenue += amount;
                }
                else if (c.billing_cycle === 'quarterly') {
                    monthlyRevenue += amount / 3;
                }
                else if (c.billing_cycle === 'yearly') {
                    monthlyRevenue += amount / 12;
                }
            });
        }
        // 2. Query expenses for this month
        const { data: expenses, error: expError } = await supabase_1.supabaseAdmin
            .from('expenses')
            .select('*')
            .gte('date', start)
            .lt('date', end);
        if (expError) {
            res.status(500).json({ error: expError.message });
            return;
        }
        // 3. Query salaries for this month
        const { data: salaries, error: salError } = await supabase_1.supabaseAdmin
            .from('salaries')
            .select('amount')
            .eq('month', start);
        if (salError) {
            res.status(500).json({ error: salError.message });
            return;
        }
        // Calculate totals
        const totalSalaries = (salaries || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
        const totalOther = (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const totalExpenses = totalSalaries + totalOther;
        // Group general expenses by category
        const byCategory = {
            ads: 0,
            software: 0,
            office: 0,
            freelancer: 0,
            salary: 0,
            other: 0,
        };
        (expenses || []).forEach(e => {
            if (e.category in byCategory) {
                byCategory[e.category] += Number(e.amount) || 0;
            }
            else {
                byCategory.other += Number(e.amount) || 0;
            }
        });
        const stats = {
            totalExpensesThisMonth: totalExpenses,
            totalSalariesThisMonth: totalSalaries,
            totalOtherThisMonth: totalOther,
            byCategory,
            netProfitThisMonth: monthlyRevenue - totalExpenses,
        };
        res.json({ stats });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch expenses stats' });
    }
});
// POST /api/expenses — Create a new expense
router.post('/', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { title, amount, category, date, note, is_recurring, recurrence } = req.body;
    if (!title || amount === undefined || !category || !date) {
        res.status(400).json({ error: 'Title, amount, category, and date are required' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('expenses')
            .insert({
            title,
            amount: Number(amount),
            category,
            date,
            note: note || null,
            is_recurring: Boolean(is_recurring),
            recurrence: recurrence || null,
            created_by: req.user.id,
        })
            .select()
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.status(201).json({ expense: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create expense' });
    }
});
// PUT /api/expenses/:id — Update an expense
router.put('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { id } = req.params;
    const { title, amount, category, date, note, is_recurring, recurrence } = req.body;
    try {
        const updates = {};
        if (title !== undefined)
            updates.title = title;
        if (amount !== undefined)
            updates.amount = Number(amount);
        if (category !== undefined)
            updates.category = category;
        if (date !== undefined)
            updates.date = date;
        if (note !== undefined)
            updates.note = note || null;
        if (is_recurring !== undefined)
            updates.is_recurring = Boolean(is_recurring);
        if (recurrence !== undefined)
            updates.recurrence = recurrence || null;
        const { data, error } = await supabase_1.supabaseAdmin
            .from('expenses')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ expense: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update expense' });
    }
});
// DELETE /api/expenses/:id — Delete an expense
router.delete('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('expenses')
            .delete()
            .eq('id', id);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'Expense deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});
exports.default = router;

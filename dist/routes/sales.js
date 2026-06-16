"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const roleCheck_1 = require("../middleware/roleCheck");
const router = (0, express_1.Router)();
// GET /api/sales/dashboard — Fetch personal sales stats, targets, call logs, phone list, historical deals
router.get('/dashboard', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    let userId = req.user.id;
    if (req.user.role === 'owner' && req.query.userId && typeof req.query.userId === 'string') {
        userId = req.query.userId;
    }
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    try {
        // 1. Fetch sales target for current month
        const { data: targetData } = await supabase_1.supabaseAdmin
            .from('sales_targets')
            .select('*')
            .eq('user_id', userId)
            .eq('month', currentMonth)
            .maybeSingle();
        // 2. Fetch clients associated with this rep
        const { data: clients, error: clientsErr } = await supabase_1.supabaseAdmin
            .from('clients')
            .select('*')
            .eq('sales_rep_id', userId)
            .order('created_at', { ascending: false });
        if (clientsErr) {
            res.status(500).json({ error: clientsErr.message });
            return;
        }
        // 3. Fetch contracts associated with this rep
        const { data: contracts, error: contractsErr } = await supabase_1.supabaseAdmin
            .from('contracts')
            .select('*, installments:contract_installments(*)')
            .eq('sales_rep_id', userId);
        if (contractsErr) {
            res.status(500).json({ error: contractsErr.message });
            return;
        }
        // 4. Fetch call logs
        const { data: callLogs } = await supabase_1.supabaseAdmin
            .from('sales_call_logs')
            .select('*, client:clients(id, name, company)')
            .eq('sales_rep_id', userId)
            .order('call_date', { ascending: false });
        // ── Compute achievements ────────────────────────────────────────────────
        let mrr = 0;
        let collectedRevenue = 0;
        (contracts || []).forEach((c) => {
            if (c.status !== 'active')
                return;
            const amount = Number(c.amount) || 0;
            if (c.is_recurring) {
                // Compute MRR contribution
                if (c.billing_cycle === 'monthly')
                    mrr += amount;
                else if (c.billing_cycle === 'quarterly')
                    mrr += amount / 3;
                else if (c.billing_cycle === 'yearly')
                    mrr += amount / 12;
                // For simplicity: assume recurring revenue is fully collected for the months active
                collectedRevenue += amount;
            }
            else {
                // One-time: count only paid installments
                (c.installments || []).forEach((inst) => {
                    if (inst.paid) {
                        collectedRevenue += Number(inst.amount) || 0;
                    }
                });
            }
        });
        const activeLeads = (clients || []).filter(c => !['won', 'lost'].includes(c.pipeline_stage));
        const historicalDeals = (clients || []).filter(c => ['won', 'lost'].includes(c.pipeline_stage));
        const totalDealsWon = (clients || []).filter(c => c.pipeline_stage === 'won').length;
        const totalMeetingsDone = (clients || []).filter(c => c.pipeline_stage === 'meeting_done').length;
        res.json({
            target: targetData || null,
            achievements: {
                mrr: Math.round(mrr * 100) / 100,
                totalDealsWon,
                totalMeetingsDone,
                collectedRevenue: Math.round(collectedRevenue * 100) / 100,
            },
            phoneList: activeLeads,
            historicalDeals,
            callLogs: callLogs || [],
        });
    }
    catch (err) {
        console.error('Failed to compile sales dashboard stats:', err);
        res.status(500).json({ error: 'Internal server error calculating sales stats' });
    }
});
// POST /api/sales/target — Set or update target for sales rep (owner only)
router.post('/target', auth_1.authMiddleware, roleCheck_1.ownerOnly, async (req, res) => {
    const { user_id, target_amount, month } = req.body;
    if (!user_id || target_amount === undefined || !month) {
        res.status(400).json({ error: 'user_id, target_amount, and month (YYYY-MM) are required' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('sales_targets')
            .upsert({ user_id, target_amount: Number(target_amount), month }, { onConflict: 'user_id,month' })
            .select()
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ target: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to set target' });
    }
});
// GET /api/sales/target/:userId/:month — Fetch target for a specific user and month (owner or self)
router.get('/target/:userId/:month', auth_1.authMiddleware, async (req, res) => {
    const { userId, month } = req.params;
    const callerId = req.user.id;
    const callerRole = req.user.role;
    if (callerRole !== 'owner' && callerId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('sales_targets')
            .select('*')
            .eq('user_id', userId)
            .eq('month', month)
            .maybeSingle();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ target: data || null });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch target' });
    }
});
// POST /api/sales/leads — Add a new prospective lead / deal (owner or sales)
router.post('/leads', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const body = req.body;
    const salesRepId = req.user.id;
    try {
        if (Array.isArray(body)) {
            // Validate all items
            for (const item of body) {
                if (!item.name || !item.phone) {
                    res.status(400).json({ error: 'Each lead in the list must have a name and phone number' });
                    return;
                }
            }
            const insertData = body.map(item => ({
                name: item.name,
                company: item.company || null,
                email: item.email || null,
                phone: item.phone,
                status: 'active',
                pipeline_stage: item.pipeline_stage || 'new_lead',
                sales_rep_id: salesRepId,
            }));
            const { data, error } = await supabase_1.supabaseAdmin
                .from('clients')
                .insert(insertData)
                .select();
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            res.status(201).json({ leads: data });
            return;
        }
        const { name, company, email, phone, pipeline_stage } = body;
        if (!name || !phone) {
            res.status(400).json({ error: 'Lead name and phone number are required' });
            return;
        }
        const { data, error } = await supabase_1.supabaseAdmin
            .from('clients')
            .insert({
            name,
            company: company || null,
            email: email || null,
            phone,
            status: 'active',
            pipeline_stage: pipeline_stage || 'new_lead',
            sales_rep_id: salesRepId,
        })
            .select()
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.status(201).json({ lead: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create lead(s)' });
    }
});
// GET /api/sales/leads/:leadId — Get a single lead with their details and call logs (owner or sales)
router.get('/leads/:leadId', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { leadId } = req.params;
    const salesRepId = req.user.id;
    try {
        const { data: lead, error: fetchErr } = await supabase_1.supabaseAdmin
            .from('clients')
            .select('*')
            .eq('id', leadId)
            .single();
        if (fetchErr || !lead) {
            res.status(404).json({ error: 'Lead not found' });
            return;
        }
        if (req.user.role !== 'owner' && lead.sales_rep_id !== salesRepId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        // Fetch call logs for this lead
        const { data: callLogs } = await supabase_1.supabaseAdmin
            .from('sales_call_logs')
            .select('*')
            .eq('client_id', leadId)
            .order('call_date', { ascending: false });
        res.json({ lead, callLogs: callLogs || [] });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch lead details' });
    }
});
// POST /api/sales/leads/:leadId/calls — Log a call outcome and comments (owner or sales)
router.post('/leads/:leadId/calls', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { leadId } = req.params;
    const { notes, outcome, meeting_date } = req.body;
    const salesRepId = req.user.id;
    if (!outcome) {
        res.status(400).json({ error: 'Call outcome is required' });
        return;
    }
    try {
        // 1. Verify lead belongs to sales rep (or caller is owner)
        const { data: lead, error: fetchErr } = await supabase_1.supabaseAdmin
            .from('clients')
            .select('*')
            .eq('id', leadId)
            .single();
        if (fetchErr || !lead) {
            res.status(404).json({ error: 'Lead not found' });
            return;
        }
        if (req.user.role !== 'owner' && lead.sales_rep_id !== salesRepId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        // 2. Insert call log
        const { error: logErr } = await supabase_1.supabaseAdmin
            .from('sales_call_logs')
            .insert({
            client_id: leadId,
            sales_rep_id: salesRepId,
            notes: notes || null,
            outcome,
        });
        if (logErr) {
            res.status(500).json({ error: logErr.message });
            return;
        }
        // 3. Update client stage & meeting_date if scheduled
        const updates = { pipeline_stage: outcome };
        if (outcome === 'meeting_scheduled' && meeting_date) {
            updates.meeting_date = meeting_date;
        }
        const { data: updatedLead, error: updateErr } = await supabase_1.supabaseAdmin
            .from('clients')
            .update(updates)
            .eq('id', leadId)
            .select()
            .single();
        if (updateErr) {
            res.status(500).json({ error: updateErr.message });
            return;
        }
        res.json({ lead: updatedLead });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to log call' });
    }
});
// POST /api/sales/leads/:leadId/close-won — Close a deal, create contract/project & kickoff tasks (owner or sales)
router.post('/leads/:leadId/close-won', auth_1.authMiddleware, roleCheck_1.ownerOrSales, async (req, res) => {
    const { leadId } = req.params;
    const { name, amount, is_recurring, billing_cycle, start_date, renewal_date, tasks } = req.body;
    const salesRepId = req.user.id;
    if (!name || !amount) {
        res.status(400).json({ error: 'Contract name and amount are required to close won' });
        return;
    }
    try {
        // 1. Fetch lead & verify ownership
        const { data: lead, error: fetchErr } = await supabase_1.supabaseAdmin
            .from('clients')
            .select('*')
            .eq('id', leadId)
            .single();
        if (fetchErr || !lead) {
            res.status(404).json({ error: 'Lead not found' });
            return;
        }
        if (req.user.role !== 'owner' && lead.sales_rep_id !== salesRepId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        // 2. Update client pipeline_stage to 'won'
        await supabase_1.supabaseAdmin
            .from('clients')
            .update({ pipeline_stage: 'won' })
            .eq('id', leadId);
        // 3. Create Project
        const { data: project, error: projErr } = await supabase_1.supabaseAdmin
            .from('projects')
            .insert({
            client_id: leadId,
            name: `${lead.company || lead.name} - Project`,
            status: 'active',
            budget: Number(amount),
            start_date: start_date || new Date().toISOString().split('T')[0],
        })
            .select()
            .single();
        if (projErr) {
            res.status(500).json({ error: projErr.message });
            return;
        }
        // 4. Create Contract
        const { data: contract, error: contractErr } = await supabase_1.supabaseAdmin
            .from('contracts')
            .insert({
            client_id: leadId,
            project_id: project.id,
            name,
            amount: Number(amount),
            is_recurring: is_recurring !== false,
            billing_cycle: is_recurring ? (billing_cycle || 'monthly') : 'one_time',
            status: 'active',
            start_date: start_date || new Date().toISOString().split('T')[0],
            renewal_date: is_recurring ? (renewal_date || null) : null,
            sales_rep_id: salesRepId,
        })
            .select()
            .single();
        if (contractErr) {
            res.status(500).json({ error: contractErr.message });
            return;
        }
        // 5. Create kickoff tasks if requested
        const createdTasks = [];
        if (Array.isArray(tasks) && tasks.length > 0) {
            for (const t of tasks) {
                const { data: task, error: taskErr } = await supabase_1.supabaseAdmin
                    .from('tasks')
                    .insert({
                    title: t.title,
                    description: t.description || null,
                    priority: t.priority || 'medium',
                    status: 'todo',
                    due_date: t.dueDate || null,
                    content_type: t.contentType || null,
                    content_description: t.contentDescription || null,
                    drive_link: t.driveLink || null,
                    project_id: t.projectId || project.id,
                    creator_id: salesRepId,
                    client_id: leadId,
                })
                    .select()
                    .single();
                if (!taskErr && task) {
                    const assigneesToInsert = (Array.isArray(t.assigneeIds) && t.assigneeIds.length > 0)
                        ? t.assigneeIds
                        : [salesRepId];
                    for (const uid of assigneesToInsert) {
                        await supabase_1.supabaseAdmin
                            .from('task_assignees')
                            .insert({ task_id: task.id, user_id: uid, status: 'todo' });
                    }
                    createdTasks.push(task);
                }
            }
        }
        res.status(201).json({
            message: 'Deal closed successfully!',
            project,
            contract,
            tasks: createdTasks,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to close deal' });
    }
});
exports.default = router;

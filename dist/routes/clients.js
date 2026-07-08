"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const roleCheck_1 = require("../middleware/roleCheck");
const deliverables_1 = require("../lib/deliverables");
const router = (0, express_1.Router)();
// GET /api/clients/reports/custom — Get custom client report (owner only)
router.get('/reports/custom', auth_1.authMiddleware, roleCheck_1.ownerOnly, async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        res.status(400).json({ error: 'startDate and endDate query parameters are required' });
        return;
    }
    try {
        const sDate = String(startDate);
        const eDate = String(endDate);
        const { data: clients, error } = await supabase_1.supabaseAdmin
            .from('clients')
            .select('*, sales_rep:profiles(name), contracts(*)');
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        // Filter by created_at or start_date within the window in Cairo local timezone
        const filtered = (clients || []).filter((c) => {
            const cDate = c.created_at ? c.created_at.substring(0, 10) : null;
            const sDateVal = c.start_date ? c.start_date.substring(0, 10) : null;
            const createdInRange = cDate && cDate >= sDate && cDate <= eDate;
            const startedInRange = sDateVal && sDateVal >= sDate && sDateVal <= eDate;
            return createdInRange || startedInRange;
        });
        const populated = await (0, deliverables_1.populateDynamicDeliverables)(filtered);
        res.json({ clients: populated });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch custom report' });
    }
});
// GET /api/clients/portal/data - Get client portal data (accessible by client role)
router.get('/portal/data', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        if (role !== 'client') {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        // 1. Get client details linked to this user_id
        const { data: client, error: clientErr } = await supabase_1.supabaseAdmin
            .from('clients')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        if (clientErr) {
            res.status(500).json({ error: clientErr.message });
            return;
        }
        if (!client) {
            res.status(404).json({ error: 'Client profile not found for this user account' });
            return;
        }
        // Populate dynamic deliverables for current month progress
        const [populatedClient] = await (0, deliverables_1.populateDynamicDeliverables)([client]);
        // 2. Fetch FAQs
        const { data: faq, error: faqErr } = await supabase_1.supabaseAdmin
            .from('client_faq')
            .select('*')
            .eq('client_id', client.id)
            .order('sort_order', { ascending: true });
        // 3. Fetch approved or published content plans (only basic fields, exclude drafts)
        const { data: contentPlans, error: plansErr } = await supabase_1.supabaseAdmin
            .from('client_content_plans')
            .select('id, title, content_type, status, scheduled_date, drive_link')
            .eq('client_id', client.id)
            .in('status', ['approved', 'published'])
            .order('scheduled_date', { ascending: true });
        // 4. Fetch performance reports (Views, Engagement, etc.)
        const { data: reports, error: reportsErr } = await supabase_1.supabaseAdmin
            .from('client_reports')
            .select('*')
            .eq('client_id', client.id)
            .order('report_month', { ascending: false });
        res.json({
            client: populatedClient,
            faq: faq || [],
            contentPlans: contentPlans || [],
            reports: reports || [],
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to load client portal data' });
    }
});
// GET /api/clients — List all clients
router.get('/', auth_1.authMiddleware, roleCheck_1.ownerOrSalesOrTeamLeaderOrAccountManager, async (_req, res) => {
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        const populated = await (0, deliverables_1.populateDynamicDeliverables)(data || []);
        res.json({ clients: populated });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});
// POST /api/clients — Create a new client
router.post('/', auth_1.authMiddleware, roleCheck_1.ownerOrSalesOrTeamLeaderOrAccountManager, async (req, res) => {
    const { name, company, email, phone, status, pipeline_stage, start_date, address, content_plan_link, num_posts, num_reels, num_stories, num_photos, other_deliverables, done_posts, done_reels, done_stories, done_photos, done_other, deliverables_schedule, user_id } = req.body;
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
            start_date: start_date || null,
            address: address || null,
            content_plan_link: content_plan_link || null,
            num_posts: num_posts ?? 0,
            num_reels: num_reels ?? 0,
            num_stories: num_stories ?? 0,
            num_photos: num_photos ?? 0,
            other_deliverables: other_deliverables || null,
            done_posts: done_posts ?? 0,
            done_reels: done_reels ?? 0,
            done_stories: done_stories ?? 0,
            done_photos: done_photos ?? 0,
            done_other: done_other ?? false,
            deliverables_schedule: deliverables_schedule || { posts: [], reels: [], stories: [], photos: [] },
            user_id: user_id || null,
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
router.put('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrSalesOrTeamLeaderOrAccountManager, async (req, res) => {
    const { id } = req.params;
    const { name, company, email, phone, status, pipeline_stage, start_date, address, content_plan_link, num_posts, num_reels, num_stories, num_photos, other_deliverables, done_posts, done_reels, done_stories, done_photos, done_other, deliverables_schedule, user_id } = req.body;
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
        if (start_date !== undefined)
            updates.start_date = start_date || null;
        if (address !== undefined)
            updates.address = address || null;
        if (content_plan_link !== undefined)
            updates.content_plan_link = content_plan_link || null;
        if (num_posts !== undefined)
            updates.num_posts = num_posts;
        if (num_reels !== undefined)
            updates.num_reels = num_reels;
        if (num_stories !== undefined)
            updates.num_stories = num_stories;
        if (num_photos !== undefined)
            updates.num_photos = num_photos;
        if (other_deliverables !== undefined)
            updates.other_deliverables = other_deliverables || null;
        if (done_posts !== undefined)
            updates.done_posts = done_posts;
        if (done_reels !== undefined)
            updates.done_reels = done_reels;
        if (done_stories !== undefined)
            updates.done_stories = done_stories;
        if (done_photos !== undefined)
            updates.done_photos = done_photos;
        if (done_other !== undefined)
            updates.done_other = done_other;
        if (deliverables_schedule !== undefined)
            updates.deliverables_schedule = deliverables_schedule;
        if (user_id !== undefined)
            updates.user_id = user_id || null;
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
router.delete('/:id', auth_1.authMiddleware, roleCheck_1.ownerOrSalesOrTeamLeaderOrAccountManager, async (req, res) => {
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

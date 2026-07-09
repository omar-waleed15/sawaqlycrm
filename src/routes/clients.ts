import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOnly, ownerOrSalesOrTeamLeaderOrAccountManager, ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator } from '../middleware/roleCheck';
import { populateDynamicDeliverables } from '../lib/deliverables';

const router = Router();

// GET /api/clients/reports/custom — Get custom client report (owner only)
router.get('/reports/custom', authMiddleware, ownerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    return;
  }

  try {
    const sDate = String(startDate);
    const eDate = String(endDate);

    const { data: clients, error } = await supabaseAdmin
      .from('clients')
      .select('*, sales_rep:profiles!clients_sales_rep_id_fkey(name), contracts(*)');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Filter by created_at or start_date within the window in Cairo local timezone
    const filtered = (clients || []).filter((c: any) => {
      const cDate = c.created_at ? c.created_at.substring(0, 10) : null;
      const sDateVal = c.start_date ? c.start_date.substring(0, 10) : null;

      const createdInRange = cDate && cDate >= sDate && cDate <= eDate;
      const startedInRange = sDateVal && sDateVal >= sDate && sDateVal <= eDate;

      return createdInRange || startedInRange;
    });

    const populated = await populateDynamicDeliverables(filtered);
    res.json({ clients: populated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch custom report' });
  }
});

// GET /api/clients/portal/data - Get client portal data (accessible by client role)
router.get('/portal/data', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    if (role !== 'client') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // 1. Get client details linked to this user_id
    const { data: client, error: clientErr } = await supabaseAdmin
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
    const [populatedClient] = await populateDynamicDeliverables([client]);

    // 2. Fetch FAQs
    const { data: faq, error: faqErr } = await supabaseAdmin
      .from('client_faq')
      .select('*')
      .eq('client_id', client.id)
      .order('sort_order', { ascending: true });

    // 3. Fetch approved or published content plans (only basic fields, exclude drafts)
    const { data: contentPlans, error: plansErr } = await supabaseAdmin
      .from('client_content_plans')
      .select('id, title, content_type, status, scheduled_date, drive_link')
      .eq('client_id', client.id)
      .in('status', ['approved', 'published'])
      .order('scheduled_date', { ascending: true });

    // Fetch new content items
    const { data: contents, error: contentsErr } = await supabaseAdmin
      .from('contents')
      .select('id, title, content_type, status, scheduled_date, drive_link, platform, media_urls, caption, sound, created_at, updated_at')
      .eq('client_id', client.id)
      .order('scheduled_date', { ascending: true });

    // 4. Fetch performance reports (Views, Engagement, etc.)
    const { data: reports, error: reportsErr } = await supabaseAdmin
      .from('client_reports')
      .select('*')
      .eq('client_id', client.id)
      .order('report_month', { ascending: false });

    res.json({
      client: populatedClient,
      faq: faq || [],
      contentPlans: contentPlans || [],
      contents: contents || [],
      reports: reports || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load client portal data' });
  }
});

// GET /api/clients — List all clients
router.get('/', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*, sales_rep:profiles!clients_sales_rep_id_fkey(id, name)')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const populated = await populateDynamicDeliverables(data || []);
    res.json({ clients: populated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// POST /api/clients — Create a new client
router.post('/', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, company, email, phone, status, pipeline_stage, start_date, address, content_plan_link, num_posts, num_reels, num_stories, num_photos, other_deliverables, done_posts, done_reels, done_stories, done_photos, done_other, deliverables_schedule, user_id, sales_rep_id } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Client name is required' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
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
        sales_rep_id: sales_rep_id || null,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ client: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PUT /api/clients/:id — Update a client
router.put('/:id', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, company, email, phone, status, pipeline_stage, start_date, address, content_plan_link, num_posts, num_reels, num_stories, num_photos, other_deliverables, done_posts, done_reels, done_stories, done_photos, done_other, deliverables_schedule, user_id, sales_rep_id } = req.body;

  try {
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (company !== undefined) updates.company = company;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (status !== undefined) updates.status = status;
    if (pipeline_stage !== undefined) updates.pipeline_stage = pipeline_stage;
    if (start_date !== undefined) updates.start_date = start_date || null;
    if (address !== undefined) updates.address = address || null;
    if (content_plan_link !== undefined) updates.content_plan_link = content_plan_link || null;
    if (num_posts !== undefined) updates.num_posts = num_posts;
    if (num_reels !== undefined) updates.num_reels = num_reels;
    if (num_stories !== undefined) updates.num_stories = num_stories;
    if (num_photos !== undefined) updates.num_photos = num_photos;
    if (other_deliverables !== undefined) updates.other_deliverables = other_deliverables || null;
    if (done_posts !== undefined) updates.done_posts = done_posts;
    if (done_reels !== undefined) updates.done_reels = done_reels;
    if (done_stories !== undefined) updates.done_stories = done_stories;
    if (done_photos !== undefined) updates.done_photos = done_photos;
    if (done_other !== undefined) updates.done_other = done_other;
    if (deliverables_schedule !== undefined) updates.deliverables_schedule = deliverables_schedule;
    if (user_id !== undefined) updates.user_id = user_id || null;
    if (sales_rep_id !== undefined) updates.sales_rep_id = sales_rep_id || null;

    const { data, error } = await supabaseAdmin
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// DELETE /api/clients/:id — Delete a client
router.delete('/:id', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router;

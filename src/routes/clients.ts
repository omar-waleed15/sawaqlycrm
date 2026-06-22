import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOnly, ownerOrSalesOrTeamLeaderOrAccountManager } from '../middleware/roleCheck';

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
      .select('*, sales_rep:profiles(name), contracts(*)');

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

    res.json({ clients: filtered });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch custom report' });
  }
});

// GET /api/clients — List all clients
router.get('/', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ clients: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// POST /api/clients — Create a new client
router.post('/', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, company, email, phone, status, pipeline_stage, start_date, address, content_plan_link, num_posts, num_reels, num_stories, num_photos, other_deliverables, done_posts, done_reels, done_stories, done_photos, done_other } = req.body;

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
router.put('/:id', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManager, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, company, email, phone, status, pipeline_stage, start_date, address, content_plan_link, num_posts, num_reels, num_stories, num_photos, other_deliverables, done_posts, done_reels, done_stories, done_photos, done_other } = req.body;

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

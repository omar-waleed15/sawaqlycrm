import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOrSalesOrTeamLeaderOrAccountManager } from '../middleware/roleCheck';

const router = Router();

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
  const { name, company, email, phone, status, pipeline_stage, start_date, address, content_plan_link } = req.body;

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
  const { name, company, email, phone, status, pipeline_stage, start_date, address, content_plan_link } = req.body;

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

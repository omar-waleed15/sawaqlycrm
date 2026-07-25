import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/roles — List role descriptions
// Owner sees all roles; other members see only their own role
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
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
      const { data, error } = await supabaseAdmin
        .from('role_descriptions')
        .select('*')
        .order('role_key');

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({ roles: data || [] });
    } else {
      // Non-owner sees only their own role
      const { data, error } = await supabaseAdmin
        .from('role_descriptions')
        .select('*')
        .eq('role_key', user.role)
        .single();

      if (error && error.code !== 'PGRST116') {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({ roles: data ? [data] : [] });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch role descriptions' });
  }
});

// PUT /api/roles/:roleKey — Update a role description (owner only)
router.put('/:roleKey', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
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
    const {
      description = '',
      general_roles = '',
      job_description = '',
      job_roles = '',
      non_negotiables = '',
    } = req.body;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    if (description !== undefined) updatePayload.description = description;
    if (general_roles !== undefined) updatePayload.general_roles = general_roles;
    if (job_description !== undefined) updatePayload.job_description = job_description;
    if (job_roles !== undefined) updatePayload.job_roles = job_roles;
    if (non_negotiables !== undefined) updatePayload.non_negotiables = non_negotiables;

    const { data, error } = await supabaseAdmin
      .from('role_descriptions')
      .update(updatePayload)
      .eq('role_key', roleKey)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ role: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role description' });
  }
});

export default router;

import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOnly } from '../middleware/roleCheck';

const router = Router();

// GET /api/users — List all team members (owner, team leader, sales)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || !['owner', 'team_leader', 'sales'].includes(req.user.role)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, avatar_url, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ users: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users — Create a new team member (owner only)
router.post('/', authMiddleware, ownerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  const validRoles = ['owner', 'team_leader', 'sales', 'member'];
  const userRole = validRoles.includes(role) ? role : 'member';

  try {
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      res.status(400).json({ error: authError?.message || 'Failed to create user' });
      return;
    }

    // Insert profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        name,
        email,
        role: userRole,
      })
      .select()
      .single();

    if (profileError) {
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      res.status(500).json({ error: profileError.message });
      return;
    }

    res.status(201).json({ user: profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id — Update user (owner only)
router.put('/:id', authMiddleware, ownerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, role } = req.body;

  try {
    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (role && ['owner', 'team_leader', 'sales', 'member'].includes(role)) updates.role = role;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id — Remove a team member (owner only)
router.delete('/:id', authMiddleware, ownerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  try {
    // Delete from Supabase Auth (cascades to profiles via DB trigger)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;

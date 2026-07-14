import { Router, Request, Response } from 'express';
import { supabaseAdmin, createTempClient } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const tempClient = createTempClient();
    const { data, error } = await tempClient.auth.signInWithPassword({
      email,
      password,
    });


    if (error || !data.user || !data.session) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Fetch profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        avatar_url: profile.avatar_url,
        phone: profile.phone,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ message: 'Logged out successfully' });
});

export default router;

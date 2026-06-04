import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOrTeamLeader } from '../middleware/roleCheck';

const router = Router();

// GET /api/ideas — List all content ideas (owner only)
router.get('/', authMiddleware, ownerOrTeamLeader, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('content_ideas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ ideas: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch content ideas' });
  }
});

// POST /api/ideas — Create a new content idea (owner only)
router.post('/', authMiddleware, ownerOrTeamLeader, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, description, content_type, drive_link, content_description, rating } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const validRatings = ['good', 'medium', 'bad'];
  if (rating && !validRatings.includes(rating)) {
    res.status(400).json({ error: 'Rating must be good, medium, or bad' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('content_ideas')
      .insert({
        title,
        description: description || null,
        content_type: content_type || null,
        drive_link: drive_link || null,
        content_description: content_description || null,
        rating: rating || 'medium',
        creator_id: req.user!.id,
      })
      .select('*')
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ idea: data });
  } catch {
    res.status(500).json({ error: 'Failed to create content idea' });
  }
});

// PUT /api/ideas/:id — Update a content idea (owner only)
router.put('/:id', authMiddleware, ownerOrTeamLeader, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, description, content_type, drive_link, content_description, rating } = req.body;

  const validRatings = ['good', 'medium', 'bad'];
  if (rating && !validRatings.includes(rating)) {
    res.status(400).json({ error: 'Rating must be good, medium, or bad' });
    return;
  }

  try {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (content_type !== undefined) updates.content_type = content_type;
    if (drive_link !== undefined) updates.drive_link = drive_link;
    if (content_description !== undefined) updates.content_description = content_description;
    if (rating !== undefined) updates.rating = rating;

    const { data, error } = await supabaseAdmin
      .from('content_ideas')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ idea: data });
  } catch {
    res.status(500).json({ error: 'Failed to update content idea' });
  }
});

// DELETE /api/ideas/:id — Delete a content idea (owner only)
router.delete('/:id', authMiddleware, ownerOrTeamLeader, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('content_ideas')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Content idea deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to delete content idea' });
  }
});

export default router;
